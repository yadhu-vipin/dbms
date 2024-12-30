const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// Set up Handlebars view engine
app.engine('hbs', engine());
app.set('view engine', 'hbs');

// Explicitly set the views directory
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection setup
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'dbms-project', // Replace with your actual database name
    password: '1234',
    port: 5432,
});

// Define routes
app.get('/', (req, res) => {
    res.render('home', { layout: false }); // Render home without a layout
});

app.get('/student-login', (req, res) => {
    res.render('student-login', { layout: false }); // Render student login without a layout
});

// Handle Student Login
app.post('/student-login', async (req, res) => {
    const { rollNumber, dob } = req.body; // Get roll number and DOB from form input

    try {
        // Query the database for a matching student
        const result = await pool.query(
            'SELECT * FROM Student WHERE roll_number = $1 AND dob = $2',
            [rollNumber, dob]
        );

        if (result.rows.length > 0) {
            // Student exists
            res.send('<script>alert("Valid student!"); window.location.href="/";</script>'); // Alert and redirect
        } else {
            // Student does not exist
            res.send('<script>alert("Invalid roll number or date of birth."); window.location.href="/student-login";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
