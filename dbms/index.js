const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session'); // Import express-session

const app = express();
const PORT = process.env.PORT || 5000;

// Set up Handlebars view engine
app.engine('hbs', engine());
app.set('view engine', 'hbs');

// Explicitly set the views directory
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));

// Set up session middleware
app.use(session({
    secret: 'your_secret_key', // Change this to a secure random string
    resave: false,
    saveUninitialized: true,
}));

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
    res.render('home', { layout: false }); // Landing page
});

app.get('/student-login', (req, res) => {
    res.render('student-login', { layout: false }); // Student login page
});

// Handle Student Login
app.post('/student-login', async (req, res) => {
    const { rollNumber, dob, schoolId } = req.body; // Get roll number, DOB, and school ID from form input

    try {
        // First, check if the school ID exists
        const schoolCheck = await pool.query(
            'SELECT * FROM School WHERE school_id = $1',
            [schoolId]
        );

        if (schoolCheck.rows.length === 0) {
            return res.send('<script>alert("Invalid School ID."); window.location.href="/student-login";</script>');
        }

        // Now check if the student exists with the provided roll number and DOB
        const studentCheck = await pool.query(
            'SELECT * FROM Student WHERE roll_number = $1 AND dob = $2',
            [rollNumber, dob]
        );

        if (studentCheck.rows.length > 0) {
            const studentId = studentCheck.rows[0].student_id; // Get student_id from result
            const studentSchoolId = schoolCheck.rows[0].school_id; // Get associated school_id

            // Verify that the student's school_id matches the provided schoolId
            if (studentSchoolId !== parseInt(schoolId)) {
                return res.send('<script>alert("The provided School ID does not match with the student record."); window.location.href="/student-login";</script>');
            }

            req.session.studentId = studentId; // Store student_id in session
            req.session.schoolId = schoolId; // Store school_id in session
            res.redirect('/student-info'); // Redirect to student info page
        } else {
            res.send('<script>alert("Invalid roll number or date of birth."); window.location.href="/student-login";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});




// Route to display student information
app.get('/student-info', async (req, res) => {
    if (!req.session.studentId) {
        return res.redirect('/student-login'); // Redirect if not logged in
    }

    try {
        const studentId = req.session.studentId;
        const schoolId = req.session.schoolId;

        const studentResult = await pool.query(
            'SELECT * FROM Student WHERE student_id = $1',
            [studentId]
        );

        const studentNameResult = await pool.query(
            'SELECT * FROM Student_Name WHERE student_id = $1',
            [studentId]
        );

        const schoolResult = await pool.query(
            'SELECT * FROM School WHERE school_id = $1',
            [schoolId]
        );

        if (studentResult.rows.length > 0 && studentNameResult.rows.length > 0 && schoolResult.rows.length > 0) {
            const studentInfo = studentResult.rows[0];
            const studentNameInfo = studentNameResult.rows[0];
            const schoolInfo = schoolResult.rows[0];

            // Render the student information page with data
            res.render('student-info', {
                layout: false,
                studentId: studentInfo.student_id,
                rollNumber: studentInfo.roll_number,
                gender: studentInfo.gender,
                dob: studentInfo.dob,
                firstName: studentNameInfo.first_name,
                middleName: studentNameInfo.middle_name,
                lastName: studentNameInfo.last_name,
                schoolName: schoolInfo.school_name,
                district: schoolInfo.district,
                state: schoolInfo.state,
            });
        } else {
            res.send('<script>alert("No information found for this student or their school."); window.location.href="/";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});
app.get('/student-marks', async (req, res) => {
    if (!req.session.studentId) {
        return res.redirect('/student-login'); // Redirect if not logged in
    }

    const examId = req.query.examId; // Get exam ID from query parameters
    const studentId = req.session.studentId; // Get student ID from session

    try {
        // Corrected SQL query to get marks awarded to the student for the specified exam
        const marksResult = await pool.query(
            'SELECT ASheet.marks_awarded, ES.subject_first_part, ES.subject_second_part ' +
            'FROM Answer_Sheet AS ASheet ' + // Use a valid alias
            'JOIN Exam_Subject ES ON ASheet.exam_id = ES.exam_id ' +
            'WHERE ASheet.student_id = $1 AND ASheet.exam_id = $2',
            [studentId, examId]
        );

        if (marksResult.rows.length > 0) {
            // Render the marks page with data
            res.render('student-marks', {
                layout: false,
                marks: marksResult.rows,
                examId: examId
            });
        } else {
            res.send('<script>alert("No marks found for this exam."); window.location.href="/";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});
// Route to serve the examiner login page
app.get('/examiner-login', (req, res) => {
    res.render('examiner-login', { layout: false }); // Render the examiner login template
});

app.post('/examiner-login', async (req, res) => {
    const { examinerId, password } = req.body; // Get examiner ID and password from form input

    try {
        // Query to check if the examiner exists with the provided ID and password
        const result = await pool.query(
            'SELECT E.examiner_id FROM Examiner E ' +
            'JOIN examiner_passwords EP ON E.examiner_id = EP.examiner_id ' +
            'WHERE E.examiner_id = $1 AND EP.password = $2',
            [examinerId, password]
        );

        if (result.rows.length > 0) {
            // Successful login
            req.session.examinerId = result.rows[0].examiner_id; // Store examiner ID in session
            res.redirect('/examiner-dashboard'); // Redirect to examiner dashboard or another page
        } else {
            res.send('<script>alert("Invalid Examiner ID or Password."); window.location.href="/examiner-login";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }

});

// Route to serve the examiner dashboard
// Route to serve the examiner dashboard
app.get('/examiner-dashboard', (req, res) => {
    if (!req.session.examinerId) {
        return res.redirect('/examiner-login'); // Redirect if not logged in
    }
    res.render('examiner-dashboard', { layout: false }); // Render the examiner dashboard template
});


// Route for Evaluation
app.get('/evaluation', (req, res) => {
    if (!req.session.examinerId) {
        return res.redirect('/examiner-login'); // Redirect if not logged in
    }
    // Here you can render an evaluation page or handle evaluation logic
    res.send('<h1>Evaluation Page</h1><p>This is where the evaluation functionality will be implemented.</p>');
});

// Route for Invigilation
app.get('/invigilation', async (req, res) => {
    if (!req.session.examinerId) {
        return res.redirect('/examiner-login'); // Redirect if not logged in
    }

    const examinerId = req.session.examinerId; // Get examiner ID from session

    try {
        // Query to get exams assigned to this examiner along with their dates and names
        const examsResult = await pool.query(
            'SELECT IA.assignment_id, IA.assignment_date, IA.exam_id, Ex.date AS exam_date, Ex.time AS exam_time, ' +
            'ES.subject_first_part || \', \' || ES.subject_second_part AS exam_name ' +
            'FROM Invigilation_Assignment IA ' +
            'JOIN Exam Ex ON IA.exam_id = Ex.exam_id ' +
            'JOIN Exam_Subject ES ON IA.exam_id = ES.exam_id ' +
            'WHERE IA.examiner_id = $1',
            [examinerId]
        );

        if (examsResult.rows.length > 0) {
            // Render an invigilation page with exam details
            res.render('invigilation', {
                layout: false,
                exams: examsResult.rows
            });
        } else {
            res.send('<script>alert("No invigilation assignments found for this examiner."); window.location.href="/examiner-dashboard";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});
app.get('/evaluation-list', async (req, res) => {
    if (!req.session.examinerId) {
        return res.redirect('/examiner-login'); // Redirect if not logged in
    }

    const examinerId = req.session.examinerId; // Get examiner ID from session

    try {
        // Query to get all answer sheets assigned to this examiner
        const evaluationsResult = await pool.query(
            'SELECT answerSheet.answersheet_id, SN.first_name, SN.last_name, Ex.exam_id, Ex.date AS exam_date, Ex.time AS exam_time, ' +
            'ES.subject_first_part, ES.subject_second_part, answerSheet.marks_awarded ' +
            'FROM Answer_Sheet answerSheet ' + // Changed alias to answerSheet
            'JOIN Student S ON answerSheet.student_id = S.student_id ' +
            'JOIN Student_Name SN ON S.student_id = SN.student_id ' + // Join with Student_Name table
            'JOIN Exam Ex ON answerSheet.exam_id = Ex.exam_id ' + // Correctly referencing "Ex"
            'JOIN Exam_Subject ES ON Ex.exam_id = ES.exam_id ' +
            'WHERE answerSheet.examiner_id = $1',
            [examinerId]
        );

        if (evaluationsResult.rows.length > 0) {
            // Render the evaluation list page with retrieved data
            res.render('evaluation-list', {
                layout: false,
                evaluations: evaluationsResult.rows,
                examiner: { examiner_first_name: "Examiner First Name", examiner_last_name: "Examiner Last Name" } // Replace with actual examiner data if needed
            });
        } else {
            res.send('<script>alert("No answer sheets found for evaluation."); window.location.href="/examiner-dashboard";</script>');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});

app.post('/update-marks', async (req, res) => {
    const { answersheet_id, marks_awarded } = req.body;

    try {
        // Update the marks awarded in the Answer_Sheet table
        await pool.query(
            'UPDATE Answer_Sheet SET marks_awarded = $1 WHERE answersheet_id = $2',
            [marks_awarded, answersheet_id]
        );

        // Redirect back to the evaluation page with a success message
        res.redirect('/examiner-dashboard'); // Redirecting to dashboard after update
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});









// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
