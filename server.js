const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = require('express')();
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
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
// In server.js, modify the workdiary POST endpoint
app.post('/sunderesh/backend/workdiary', async (req, res) => {
    let connection;
    try {
        console.log('=== New Workdiary Request ===');
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Thumbnail present in request:', 'thumbnailURL' in req.body);
        
        if (req.body.thumbnailURL) {
            console.log('Thumbnail data length:', req.body.thumbnailURL.length);
            console.log('Thumbnail data start:', req.body.thumbnailURL.substring(0, 50) + '...');
        }

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
            thumbnailURL,
            activeFlag,
            deletedFlag,
            activeMins
        } = req.body;

        console.log('Extracted thumbnailURL length:', thumbnailURL ? thumbnailURL.length : 0);

        // Input validation
        if (!projectID || !userID || !taskID) {
            console.error('Missing required fields');
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        connection = await pool.getConnection();
        console.log('Executing SQL with thumbnailURL length:', thumbnailURL ? thumbnailURL.length : 0);
        
        const [result] = await connection.execute(`
            INSERT INTO workdiary 
            (projectID, projectName, userID, taskID, taskName, screenshotTimeStamp, calcTimeStamp, 
             keyboardJSON, mouseJSON, imageURL, thumbnailURL, activeFlag, activeMins, deletedFlag, createdAt, modifiedAT) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
            thumbnailURL || '',
            activeFlag !== undefined ? activeFlag : 1,
            activeMins || 0,
            deletedFlag !== undefined ? deletedFlag : 0
        ]);

        console.log('Insert successful, ID:', result.insertId);
        connection.release();
        
        // Verify the inserted data
        const [inserted] = await connection.execute(
            'SELECT id, projectID, taskID, LENGTH(thumbnailURL) as thumbnailLength FROM workdiary WHERE id = ?',
            [result.insertId]
        );
        console.log('Inserted record info:', inserted[0]);

        res.json({
            success: true,
            insertedId: result.insertId
        });

    } catch (error) {
        console.error('Database error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlMessage: error.sqlMessage,
            sql: error.sql
        });
        if (connection) connection.release();
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET endpoint to fetch workdiary entries
app.get('/sunderesh/backend/workdiary', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute('SELECT * FROM workdiary ORDER BY screenshotTimeStamp DESC');

        connection.release();

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching workdiary entries:', error);
        if (connection) connection.release();
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET endpoint to fetch workdiary entries
app.get('/sunderesh/backend/workdiary/:id', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute('SELECT * FROM workdiary WHERE id = ?', [req.params.id]);

        connection.release();

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching workdiary entries:', error);
        if (connection) connection.release();
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.patch('/sunderesh/backend/tasks/:id', async (req, res) => {
    let connection;
    try {
        const taskID = req.params.id;
        const { actHours, isExceeded } = req.body;
        
        console.log('=== PATCH Request Received ===');
        console.log('URL Params:', req.params);
        console.log('Request Body:', req.body);
        console.log('Task ID from URL:', taskID);
        
        if (!taskID) {
            console.error('No taskID provided in URL');
            return res.status(400).json({
                success: false,
                error: "taskID is required in URL"
            });
        }

        connection = await pool.getConnection();
        
        // First, verify the task exists
        console.log('Checking if task exists in database...');
        const [taskRows] = await connection.execute(
            'SELECT id, name, actHours, isExceeded FROM tasks WHERE id = ?', 
            [taskID]
        );
        
        console.log('Database query result:', taskRows);
        
        if (taskRows.length === 0) {
            console.error(`Task with ID ${taskID} not found in database`);
            return res.status(404).json({
                success: false,
                error: `Task with ID ${taskID} not found`
            });
        }
        
        const currentTask = taskRows[0];
        console.log('Found task:', currentTask);
        
        // Calculate new values
        const newActHours = actHours !== undefined ? parseFloat(actHours) : currentTask.actHours;
        const newIsExceeded = isExceeded !== undefined ? parseInt(isExceeded) : (currentTask.isExceeded || 0);
        
        console.log('Updating task with:', {
            taskID,
            newActHours,
            newIsExceeded
        });
        
        // Update the task
        const [updateResult] = await connection.execute(
            'UPDATE tasks SET actHours = ?, isExceeded = ?, modifiedAT = NOW() WHERE id = ?',
            [newActHours, newIsExceeded, taskID]
        );
        
        console.log('Update result:', {
            affectedRows: updateResult.affectedRows,
            changedRows: updateResult.changedRows
        });
        
        // Verify the update
        const [updatedTask] = await connection.execute(
            'SELECT id, name, actHours, isExceeded FROM tasks WHERE id = ?',
            [taskID]
        );
        
        console.log('Updated task data:', updatedTask[0]);
        
        connection.release();
        
        res.json({
            success: true,
            message: 'Task updated successfully',
            task: updatedTask[0]
        });

    } catch (error) {
        console.error('Error in PATCH /tasks/:id:', error);
        console.error('Error stack:', error.stack);
        if (connection) connection.release();
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

async function processScreenshotFiles() {
    const screenshotsDir = path.join(__dirname, 'public', 'screenshots');
    
    try {
        // Get all JSON files recursively
        const files = await getJsonFilesRecursively(screenshotsDir);
        console.log(`Found ${files.length} JSON files to process`);

        for (const filePath of files) {
            try {
                // Read the file
                const fileContent = await fs.readFile(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);

                // Post to workdiary endpoint
                const response = await axios.post('http://localhost:5001/sunderesh/backend/workdiary', jsonData);
                
                if (response.status === 200) {
                    // Delete the file after successful upload
                    await fs.unlink(filePath);
                    console.log(`Processed and deleted: ${filePath}`);
                }
            } catch (error) {
                console.error(`Error processing ${filePath}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Error processing screenshots:', error);
    }
}

async function getJsonFilesRecursively(dir) {
    let results = [];
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            
            if (file.isDirectory()) {
                // Recursively process all subdirectories
                const subFiles = await getJsonFilesRecursively(fullPath);
                results = results.concat(subFiles);
            } else if (file.name.endsWith('.json') && file.name.startsWith('screenshot_')) {
                // Only include files that are in a directory matching the hour pattern (e.g., "10-11")
                const parentDir = path.basename(path.dirname(fullPath));
                if (/^\d{2}-\d{2}$/.test(parentDir)) {
                    results.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }
    return results;
}

// Start server
const server = app.listen(5001, async () => {
    console.log('Backend running on http://localhost:5001');
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'public', 'screenshots');
    try {
        await fs.mkdir(screenshotsDir, { recursive: true });
        console.log(`Watching directory for changes: ${screenshotsDir}`);
        
        // Initial processing of any existing files
        await processScreenshotFiles();
        
        // Watch for new files
        const watcher = require('chokidar').watch(screenshotsDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        
        watcher.on('add', async (filePath) => {
            if (filePath.endsWith('.json')) {
                console.log(`New screenshot detected: ${filePath}`);
                await processScreenshotFiles();
            }
        });
        
        watcher.on('error', error => {
            console.error('Watcher error:', error);
        });
        
    } catch (error) {
        console.error('Error setting up file watcher:', error);
    }
});

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close();
    process.exit(0);
});
