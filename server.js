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
            projectName,
            taskName,
            taskID,
            screenshotTimeStamp,
            calcTimeStamp,
            keyboardJSON,
            mouseJSON,
            imageURL,
            activeFlag,
            deletedFlag,
            activeMins,
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
    (projectID, projectName, userID, taskID, taskName, screenshotTimeStamp, calcTimeStamp, 
     keyboardJSON, mouseJSON, imageURL, activeFlag, activeMins, deletedFlag, createdAt, modifiedAT) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
`, [
            projectID || null,
            projectName || 'Unknown Project',
            userID || 1,
            taskID || null,
            taskName || 'Unknown Task',
            screenshotTimeStamp ? new Date(screenshotTimeStamp) : new Date(),
            calcTimeStamp ? new Date(calcTimeStamp) : new Date(),
            JSON.stringify(keyboardJSON || {}),
            JSON.stringify(mouseJSON || {}),
            imageURL || '',
            activeFlag !== undefined ? activeFlag : 1,
            activeMins || 0,  // Added activeMins with default 0
            deletedFlag !== undefined ? deletedFlag : 0
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
