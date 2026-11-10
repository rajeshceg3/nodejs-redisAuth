// verify-redis-auth: isolated local verification for nodejs-redisAuth.
// Spawns an in-memory Redis (redis-memory-server) and the real app,
// drives the login/session surface with a real cookie jar, records
// evidence, cleans up only its own children.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { RedisMemoryServer } = require('redis-memory-server');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PORT = 3000; // app hardcodes this port
const EVIDENCE_DIR = process.env.VERIFY_EVIDENCE_DIR || fs.mkdtempSync('/tmp/verify-redis-auth-');
const evidence = { repo: 'nodejs-redisAuth', started_at: new Date().toISOString(),
  actions: [], findings: [], boundaries: ['local processes only', 'in-memory Redis, disposable', 'no external services'],
  cleaned: false };
let failures = 0;

function record(action, ok, detail) {
  evidence.actions.push({ at: new Date().toISOString(), action, ok, detail });
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + action + (detail ? ' :: ' + detail : ''));
}
const jar = new Map();
function cookieHeader() { return [...jar.entries()].map(([k, v]) => k + '=' + v).join('; '); }
function storeCookies(res) {
  const set = res.headers['set-cookie'];
  if (set) for (const c of set) { const [pair] = c.split(';'); const i = pair.indexOf('='); jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim()); }
}
function req(method, p, { form } = {}) {
  return new Promise((resolve, reject) => {
    const data = form ? new URLSearchParams(form).toString() : null;
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method,
      headers: Object.assign({ Cookie: cookieHeader() }, data ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) } : {}) },
      (res) => { let buf = ''; res.on('data', (c) => buf += c); res.on('end', () => { storeCookies(res); resolve({ status: res.statusCode, headers: res.headers, body: buf }); }); });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
function portFree(port) {
  return new Promise((resolve) => { const s = net.createServer(); s.once('error', () => resolve(false)); s.once('listening', () => s.close(() => resolve(true))); s.listen(port, '127.0.0.1'); });
}
async function waitReady(child, tries = 90) {
  for (let i = 0; i < tries; i++) {
    if (child.exitCode !== null) return false;
    try { const r = await req('GET', '/login'); if (r.status === 200) return true; } catch (e) {}
    await new Promise((r2) => setTimeout(r2, 500));
  }
  return false;
}
let redisServer = null, child = null;
function finish() {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1500); }
  setTimeout(async () => {
    if (redisServer) await redisServer.stop();
    evidence.cleaned = !child || child.exitCode !== null;
    evidence.finished_at = new Date().toISOString();
    evidence.failures = failures;
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'evidence.json'), JSON.stringify(evidence, null, 1));
    console.log('EVIDENCE_DIR=' + EVIDENCE_DIR);
    console.log('FAILURES=' + failures);
    process.exit(failures ? 1 : 0);
  }, 2200);
}
(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  if (!(await portFree(PORT))) { record('precheck: app port ' + PORT + ' free', false, 'refusing to attach to an unknown listener'); finish(); return; }
  record('precheck: app port ' + PORT + ' free', true);
  try { redisServer = new RedisMemoryServer(); var rport = await redisServer.getPort(); record('launch: in-memory Redis', true, 'port ' + rport); }
  catch (e) { record('launch: in-memory Redis', false, String(e && e.message || e)); finish(); return; }
  const logStream = fs.createWriteStream(path.join(EVIDENCE_DIR, 'server.log'));
  child = spawn('node', ['index.js'], { cwd: ROOT,
    env: Object.assign({}, process.env, { REDIS_PORT: String(rport), SECRET: 'verify-secret-' + Date.now() }),
    stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(logStream); child.stderr.pipe(logStream);
  try {
    const ready = await waitReady(child);
    record('launch: own child serving /login', ready);
    if (!ready) { finish(); return; }
    let r = await req('GET', '/');
    record('GET / unauthenticated redirects to /login', r.status === 302 && (r.headers.location || '').includes('/login'), 'status ' + r.status);
    r = await req('GET', '/login');
    record('GET /login renders', r.status === 200, 'status ' + r.status);
    r = await req('POST', '/login', { form: { username: 'foo', password: 'wrong' } });
    record('POST /login wrong password redirects to /login', r.status === 302 && (r.headers.location || '').includes('/login'), 'status ' + r.status);
    r = await req('GET', '/');
    record('failed login grants no session', r.status === 302 && (r.headers.location || '').includes('/login'), 'status ' + r.status);
    r = await req('POST', '/login', { form: { username: 'foo', password: 'bar' } });
    record('POST /login foo/bar redirects to /', r.status === 302 && (r.headers.location || '/') === '/', 'status ' + r.status + ' -> ' + (r.headers.location || ''));
    r = await req('GET', '/');
    record('GET / authenticated welcomes foo', r.status === 200 && r.body.includes('Welcome, foo'), 'status ' + r.status + ' body ' + r.body.slice(0, 40));
    r = await req('GET', '/');
    record('session persists across requests (Redis store)', r.status === 200 && r.body.includes('Welcome, foo'), 'status ' + r.status);
  } catch (e) {
    record('unhandled verification error', false, String(e && e.message || e));
  } finally {
    finish();
  }
})();
