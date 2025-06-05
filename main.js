const { app, BrowserWindow, ipcMain } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let isTracking = false;
let trackingInterval;
let lastMousePosition = { x: 0, y: 0 };
const MOUSE_MOVE_THROTTLE_MS = 100; // Adjust this value (100ms default)
let lastMouseEventSent = 0;
let mouseClickCount = 0;
let keyboardPressCount = 0;

// Update the tracking interval to 5 minutes (300,000 ms)
const SCREENSHOT_INTERVAL = 1 * 60 * 1000;
let currentProjectID = null;
let currentUserID = null;
let currentTaskID = null;
async function saveToWorkdiary(data) {
  const mysql = require('mysql2/promise');

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',     // Replace with your database host
      user: 'root', // Replace with your database username
      password: 'Vishal@003', // Replace with your database password
      database: 'vwsrv'
    });

    const query = `
      INSERT INTO workdiary 
      (projectID, userID, taskID, screenshotTimeStamp, calcTimeStamp, 
       imageURL, thumbNailURL, activeFlag, deletedFlag, createdAt, modifiedAT,
       mouseJSON, keyboardJSON)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.execute(query, [
      data.projectID,
      data.userID,
      data.taskID,
      data.screenshotTimeStamp,
      data.calcTimeStamp,
      data.imageURL,
      data.thumbNailURL,
      data.activeFlag,
      data.deletedFlag,
      data.createdAt,
      data.modifiedAT,
      data.mouseJSON,
      data.keyboardJSON
    ]);

    await connection.end();
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

async function takeScreenshot(mouseClickCount, keyboardPressCount) {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().workAreaSize
    });

    const screenshotBuffer = sources[0].thumbnail.toPNG();
    const base64Image = screenshotBuffer.toString('base64');
    const base64DataUrl = base64Image;

    // Create thumbnail (smaller version)
    const thumbnailSize = { width: 200, height: 150 }; // Adjust as needed
    const thumbnail = sources[0].thumbnail.resize(thumbnailSize);
    const thumbnailBuffer = thumbnail.toPNG();  // Convert thumbnail to PNG buffer
    const thumbnailBase64 = thumbnailBuffer.toString('base64');

    const workdiaryData = {
      projectID: currentProjectID,
      userID: currentUserID,
      taskID: currentTaskID,
      screenshotTimeStamp: new Date(),
      calcTimeStamp: new Date(),
      keyboardJSON: JSON.stringify({ count: keyboardPressCount }),
      mouseJSON: JSON.stringify({ count: mouseClickCount }),
      imageURL: base64DataUrl,
      thumbNailURL: thumbnailBase64,
      activeFlag: 1,
      deletedFlag: 0,
      createdAt: new Date(),
      modifiedAT: new Date()
    };

    await saveToWorkdiary(workdiaryData);

    console.log('Screenshot saved to database with activity data');
    return { success: true, message: 'Screenshot saved to database' };
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return { success: false, error: error.message };
  }
}

function sendGlobalEvent(event) {
  if (!event.type) {
    console.error('Attempted to send event without type:', event);
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('global-event', event);
  }
}

function startTracking() {
  if (isTracking) return;
  isTracking = true;

  // Start listening to all events
  uIOhook.start();

  // Set up interval for screenshots (every 5 minutes) - ONLY when tracking starts
  trackingInterval = setInterval(() => {
    // Only take screenshot if we have activity counts
    if (typeof mouseClickCount !== 'undefined' && typeof keyboardPressCount !== 'undefined') {
      takeScreenshot(mouseClickCount, keyboardPressCount);
    }
  }, SCREENSHOT_INTERVAL);

  // Mouse move event
  uIOhook.on('mousemove', (event) => {
    const now = Date.now();

    // Throttle mouse move events
    if (now - lastMouseEventSent >= MOUSE_MOVE_THROTTLE_MS) {
      lastMouseEventSent = now;
      lastMousePosition = { x: event.x, y: event.y };
      sendGlobalEvent({
        type: 'mousemove',
        x: event.x,
        y: event.y
      });
    }
  });

  // Mouse click event
  uIOhook.on('click', (event) => {
    mouseClickCount++;
    sendGlobalEvent({
      type: 'mouseclick',
      button: event.button,
      x: event.x,
      y: event.y
    });
  });

  // Key press event
  uIOhook.on('keydown', (event) => {
    keyboardPressCount++;
    sendGlobalEvent({
      type: 'keydown',
      keycode: event.keycode,
      key: UiohookKey[event.keycode] || `Unknown(${event.keycode})`,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });

    // Exit on Escape key
    if (event.keycode === UiohookKey.Escape) {
      stopTracking();
    }
  });

  console.log('Started tracking global input events');
  if (mainWindow) {
    mainWindow.webContents.send('tracking-status', { isTracking: true });
  }
}

function stopTracking() {
  if (!isTracking) return;
  isTracking = false;

  // Clear the screenshot interval
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  uIOhook.removeAllListeners();
  console.log('Stopped tracking global input events');
  if (mainWindow) {
    mainWindow.webContents.send('tracking-status', { isTracking: false });
  }

}

app.on('will-quit', () => {
  stopTracking();
  uIOhook.stop();
  uIOhook.unregisterAllShortcuts();
});

// Register IPC handlers
// In your main.js, make sure you have this IPC handler
ipcMain.handle('start-tracking', async () => {
  startTracking();
  return { success: true, isTracking };
});

ipcMain.handle('stop-tracking', async () => {
  stopTracking();
  return { success: true, isTracking };
});
ipcMain.on('tracking-status', (event, data) => {
  mainWindow.webContents.send('tracking-status', data);
});

ipcMain.on('tracking-error', (event, error) => {
  mainWindow.webContents.send('tracking-error', error);
});
// Add this with your other IPC handlers in main.js
ipcMain.handle('get-tracking-status', async () => {
  return { isTracking };
});
ipcMain.handle('set-tracking-context', (event, context) => {
  currentProjectID = context.projectID;
  currentUserID = context.userID;

  // Priority order: subactionItemID > actionItemID > subtaskID > taskID
  if (context.subactionItemID) {
    currentTaskID = context.subactionItemID;
    console.log('Tracking subaction item with ID:', currentTaskID);
  } else if (context.actionItemID) {
    currentTaskID = context.actionItemID;
    console.log('Tracking action item with ID:', currentTaskID);
  } else if (context.subtaskID) {
    currentTaskID = context.subtaskID;
    console.log('Tracking subtask with ID:', currentTaskID);
  } else {
    currentTaskID = context.taskID;
    console.log('Tracking task with ID:', currentTaskID);
  }

  return { success: true };
});
ipcMain.handle('take-screenshot', (event, mouseClickCount, keyboardPressCount) => {
  console.log('take-screenshot IPC handler:', { mouseClickCount, keyboardPressCount }); // Add this line
  return takeScreenshot(mouseClickCount, keyboardPressCount);
});
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },

  });

  // Load the app
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'build/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Initialize iohook
uIOhook.start(false); // Start but don't hook into any events yet

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopTracking();
    app.quit();
  }
});

// Clean up on app quit
app.on('will-quit', () => {
  stopTracking();
  uIOhook.unload();
  uIOhook.stop();
});