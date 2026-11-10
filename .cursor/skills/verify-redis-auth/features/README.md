# Feature map: nodejs-redisAuth

Purpose (from source interview): minimal Express + passport-local demo where
users and sessions live in Redis. Two seeded demo users: foo/bar and john/doe.
Logging in shows "Welcome, <username>"; everything else redirects to /login.

## Exercised by verify.cjs (real cookie jar, isolated in-memory Redis)

| Flow | What is proven |
|---|---|
| Route protection | GET / unauthenticated redirects to /login |
| Login page | GET /login renders 200 |
| Login failure | POST /login wrong password redirects to /login (regression: redis v4 promise API vs old callback style - the strategy previously threw) |
| Login success | POST /login foo/bar redirects to / and the session persists: GET / shows "Welcome, foo" |
| Session store | the session survives across requests through Redis (cookie jar proof) |

## Known boundaries (honest scope)

- Verification uses redis-memory-server: a real local redis-server binary,
  fully disposable. The app seeds its demo users on boot.
- Plaintext demo passwords and a default session secret: this is a learning
  demo, not an auth template.
- REDIS_PORT env selects the Redis port; the app hardcodes HTTP port 3000.
