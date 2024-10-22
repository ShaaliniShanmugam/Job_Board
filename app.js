// app.js
require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const Job = require('./models/Job');
const User = require('./models/User');
const LocalStrategy = require('passport-local').Strategy;

const app = express();

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Express session
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Passport config
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = await User.findOne({ username });
            if (!user) return done(null, false, { message: 'User not found' });
            const isMatch = await user.comparePassword(password);
            if (!isMatch) return done(null, false, { message: 'Incorrect password' });
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Middleware for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// Routes

// Landing Page: Display the landing page
app.get('/', (req, res) => {
    res.render('landing'); // Serve the landing page
});

// Home Page: Display all job listings
app.get('/index', async (req, res) => { // Change the route to /index for viewing jobs
    try {
        const jobs = await Job.find();
        res.render('index', { jobs });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.render('index', { jobs: [] }); // Render with empty jobs array on error
    }
});

// Job Posting Page
app.get('/post-job', (req, res) => {
    res.render('postJob');
});

// Job Details Page
app.get('/job/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).send('Job not found');
        }
        res.render('jobDetails', { job });
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).send('Server Error');
    }
});

// Submit New Job Post
app.post('/post-job', async (req, res) => {
    const newJob = new Job(req.body);
    try {
        await newJob.save();
        req.flash('success_msg', 'Job posted successfully');
        res.redirect('/index'); // Redirect to the index page after posting a job
    } catch (error) {
        console.error('Error posting job:', error);
        req.flash('error_msg', 'Failed to post job. Please try again.');
        res.redirect('/post-job');
    }
});

// Signup Page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Handle Signup
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = new User({ username, password });
        await user.save();
        req.flash('success_msg', 'You are now registered and can log in');
        res.redirect('/login');
    } catch (err) {
        console.error('Registration error:', err);
        req.flash('error_msg', 'Registration failed. User may already exist.');
        res.redirect('/signup');
    }
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle Login
app.post('/login', passport.authenticate('local', {
    successRedirect: '/index', // Redirect to the index page on successful login
    failureRedirect: '/login',
    failureFlash: true
}));

// Logout
app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) return next(err);
        req.flash('success_msg', 'You have successfully logged out');
        res.redirect('/');
    });
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Job board app running on http://localhost:${port}`);
});
