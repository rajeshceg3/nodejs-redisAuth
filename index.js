const express = require('express');
const session = require('express-session');
const redis = require('redis');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const RedisStore = require('connect-redis').default; // v7 default export, pairs with redis v4
require('dotenv').config();
const secretKey = process.env.SECRET || 'secret-key';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);

const app = express();

// Set view engine
app.set('view engine', 'ejs');

// Parse login form posts; passport-local reads req.body
app.use(express.urlencoded({ extended: false }));

// Create Redis client (redis v4 API: promises, explicit connect).
// The store only issues commands once requests arrive, and the server
// starts listening after connect() resolves, so this ordering is safe.
const redisClient = redis.createClient({
  socket: { host: 'localhost', port: REDIS_PORT },
});
redisClient.on('error', (err) => {
  console.error('Redis client error:', err);
});

// Link express-session with redis store.
// secure:false so sessions work over plain local HTTP; flip to true
// only behind real HTTPS.
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 1, // 1 hour - input taken in ms
    },
  })
);

// Initialize passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Define local auth strategy against the seeded users in Redis
const localStrategy = new LocalStrategy(async (username, password, done) => {
  try {
    const user = await redisClient.hGetAll(username);
    if (!user || Object.keys(user).length === 0) {
      return done(null, false);
    }
    if (user.password !== password) {
      return done(null, false);
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});
passport.use(localStrategy);

// Return the single parameter from user object
// which we want to store in req.session
passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser(async (username, done) => {
  try {
    const user = await redisClient.hGetAll(username);
    if (user && Object.keys(user).length > 0) {
      done(null, user);
    } else {
      done(null, false);
    }
  } catch (err) {
    done(err);
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
  })
);

app.get('/', (req, res) => {
  // Check if the user is authenticated
  if (req.isAuthenticated()) {
    res.send(`Welcome, ${req.user.username}`);
  } else {
    res.redirect('/login');
  }
});

async function main() {
  await redisClient.connect();
  console.log('Connected to Redis Server');

  // Hardcoded demo users stored in Redis
  await redisClient.hSet('foo', {
    id: '1',
    username: 'foo',
    password: 'bar'
  });
  await redisClient.hSet('john', {
    id: '2',
    username: 'john',
    password: 'doe'
  });

  app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
