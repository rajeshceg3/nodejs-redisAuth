const express = require('express');
const session = require('express-session');
const redis = require('redis');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const RedisStore = require('connect-redis')(session);
require('dotenv').config();
const secretKey = process.env.SECRET || 'secret-key';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const app = express();

// Set view engine
app.set('view engine', 'ejs');

// Create Redis client
const redisClient = redis.createClient({
  host: 'localhost',
  port: REDIS_PORT,
});

// Hardcoded user stored in redisClient db
redisClient.hSet('foo', {
  id: 1,
  username: 'foo',
  password: 'bar'
});
redisClient.hSet('john', {
  id: 2,
  username: 'john',
  password: 'doe'
});

redisClient.on('connect', ()=>{
  console.log("Connected to Redis Server");
})

// Link express-session with redis store
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // for HTTPS
      maxAge: 1000 * 60 * 60 * 1, // 1 hour - input taken in ms
    },
  })
);

// Initialize passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Define local auth strategy
const localStrategy = new LocalStrategy((username, password, done) => {
redisClient.hGetAll(username, (err, user)=>{
  if(err){
    return done(err);
  }
  if(!user){
    return done( null, false);
  }
  if(user.password !== password){
    return done( null, false);
  }
  return done(null, user);
})
});
passport.use(localStrategy);

// Return the single parameter from user object
// which we want to store in req.session
passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser((username, done) => {
  // Do a db call to look up the user object using id
  // Here, we are hard coding it and call done method with
  // entire user object
  redisClient.hGetAll(username, (err, user)=>{
    if(err){
      done(err);
    }
    if(user){
      done(null, user);
    }
  })
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
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
