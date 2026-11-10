# nodejs-redisAuth

Minimal Express + Passport.js (local strategy) demo where the seeded demo
users and the session store both live in Redis.

- Log in as `foo`/`bar` or `john`/`doe`; `/` greets the logged-in user.
- Sessions persist through Redis (`connect-redis`).

## Run

```
npm install
REDIS_PORT=6379 npm start   # needs a Redis on localhost; serves :3000
```

## Verify

```
node .cursor/skills/verify-redis-auth/verify.cjs
```

Spawns an isolated in-memory Redis and the app, exercises login success,
failure and session persistence with a real cookie jar, and writes an
evidence report. See `.cursor/skills/verify-redis-auth/`.

## Honest scope

Learning demo: plaintext demo passwords, default session secret. Not a
production auth template.

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/express-simple-ibxdzh)
