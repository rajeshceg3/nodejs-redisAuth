---
name: verify-redis-auth
description: "Verify nodejs-redisAuth's login/session surface against an isolated in-memory Redis with a real cookie jar and recorded evidence. Use before reporting behavior changes complete."
---

# Verify nodejs-redisAuth

Generated from source interview following pstack create-verification-skill. Read features/README.md first.

## Launch

From the repository root run `npm install --ignore-scripts`, then
`node .cursor/skills/verify-redis-auth/verify.cjs`. Node 18+ required
(developed on Node 22). The app hardcodes port 3000; the helper refuses to
start if that port is taken. redis-memory-server downloads a local
redis-server binary on first run; if its cache is truncated (a 0-byte
binary under node_modules/.cache/redis-memory-server), delete that cache
directory and rerun so a complete binary downloads. Never point REDIS_PORT
at a shared Redis.

## Doctor

The helper confirms its own child is alive and GET /login returns 200 before
driving. A TCP listener alone is not success. After a surprising failure,
clean up and rerun from a fresh instance.

## Drive

Run `node .cursor/skills/verify-redis-auth/verify.cjs`. It keeps a real
cookie jar and exercises the login page, a failed login, a successful login
as the seeded demo user, and session persistence across requests. All
traffic is what a real browser form sends.

## Evidence

Default location is a unique /tmp/verify-redis-auth- directory, printed at
exit. Set VERIFY_EVIDENCE_DIR to a new private persistent path to retain
proof. evidence.json records each action, response/status, assertions,
findings and cleanup; server.log captures the child output. One passing
path never means the whole map passed; check FAILURES=0.

## Cleanup

The helper signals only the processes it created (app child, in-memory
redis-server), escalates only on its own children and preserves evidence.
Confirm cleaned:true. All Redis state is disposable.

## Helpers

`node .cursor/skills/verify-redis-auth/verify.cjs` is self-contained
(stdlib plus the repo's devDependency redis-memory-server). A dependency or
redis binary failure is a blocker, not a skipped pass.

## Maintenance

After behavior changes use /maintain-verification-skill: reconcile every
mapped feature with source and exercise each live; report unreachable
prerequisites and product regressions rather than editing the map to hide
them.
