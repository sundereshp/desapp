const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = require('express')();

// Middleware configuration
app.use(bodyParser.json({ limit: '50mb' }));  // Increase from default 100kb
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Then your existing CORS and other middleware
app.use(cors({
    origin: true,
    credentials: true
}));

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Vishal@003', // Match your Electron app's credentials
    database: 'vwsrv', // Use same database as Electron app
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// POST endpoint configuration
app.post('/sunderesh/backend/workdiary', async (req, res) => {
    let connection;
    try {
        const {
            projectID,
            userID,
            taskID,
            screenshotTimeStamp,
            calcTimeStamp,
            keyboardJSON,
            mouseJSON,
            imageURL,
            activeFlag,
            deletedFlag,
            createdAt,
            modifiedAT
        } = req.body;

        // Input validation
        if (!projectID || !userID || !taskID) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        connection = await pool.getConnection();
        const [result] = await connection.execute(`
        INSERT INTO workdiary 
        (projectID, userID, taskID, screenshotTimeStamp, calcTimeStamp, 
         keyboardJSON, mouseJSON, imageURL, activeFlag, 
         deletedFlag, createdAt, modifiedAT) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())
      `, [
            projectID,
            userID,
            taskID,
            new Date(screenshotTimeStamp),
            new Date(calcTimeStamp),
            JSON.stringify(keyboardJSON || {}),
            JSON.stringify(mouseJSON || {}),
            imageURL
            // Removed the extra parameters that were causing the error
        ]);

        connection.release();
        res.json({
            success: true,
            insertedId: result.insertId
        });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(5001, () => {
    console.log('Backend running on http://localhost:5001');
});
