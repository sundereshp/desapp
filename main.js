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
const SCREENSHOT_INTERVAL = 0.1 * 60 * 1000;
let currentProjectID = null;
let currentUserID = null;
let currentTaskID = null;
let currentProjectName = null;
let currentTaskName = null;
// Remove the original saveToWorkdiary function and replace with:
async function saveToWorkdiary(data) {
  try {
    const response = await fetch('http://localhost:5001/sunderesh/backend/workdiary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectID: data.projectID,
        projectName: data.projectName,
        taskName: data.taskName,
        userID: data.userID,
        taskID: data.taskID,
        screenshotTimeStamp: data.screenshotTimeStamp.toISOString(),
        calcTimeStamp: data.calcTimeStamp.toISOString(),
        keyboardJSON: JSON.parse(data.keyboardJSON),
        mouseJSON: JSON.parse(data.mouseJSON),
        imageURL: data.imageURL,
        activeFlag: 1,
        deletedFlag: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server responded with:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Data saved via backend API');
    return await response.json();
  } catch (error) {
    console.error('API request failed:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}


async function takeScreenshot(mouseClickCount, keyboardPressCount) {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().workAreaSize
    });

    // Convert to base64 strings
    const fullSizeBase64 = sources[0].thumbnail.resize({ 
      width: 1200, height: 800,quality: 'good' 
    }).toJPEG(60).toString('base64');
    // const thumbnailBase64 = sources[0].thumbnail.resize({ 
    //   width: 400, height: 300,quality: 'good' 
    // }).toJPEG(50).toString('base64');

    const workdiaryData = {
      projectID: currentProjectID,
      projectName: currentProjectName,
      taskName: currentTaskName,
      userID: currentUserID,
      taskID: currentTaskID,
      screenshotTimeStamp: new Date(),
      calcTimeStamp: new Date(),
      keyboardJSON: JSON.stringify({ count: keyboardPressCount }),
      mouseJSON: JSON.stringify({ count: mouseClickCount }),
      imageURL: fullSizeBase64,
      // thumbNailURL: thumbnailBase64,
      activeFlag: 1,
      deletedFlag: 0,
      createdAt: new Date(),
      modifiedAT: new Date()
    };

    console.log('Screenshot data size:', 
      JSON.stringify(workdiaryData).length / 1024, 'KB');
    
    return await saveToWorkdiary(workdiaryData);
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
  currentProjectName = context.projectname;
  currentTaskName=context.taskname;
  // Priority order: subactionItemID > actionItemID > subtaskID > taskID
  if (context.subactionItemID) {
    currentTaskID = context.subactionItemID;
    currentTaskName = context.subactionname;
    console.log('Tracking subaction item with ID:', currentTaskID);
  } else if (context.actionItemID) {
    currentTaskID = context.actionItemID;
    currentTaskName = context.actionname;
    console.log('Tracking action item with ID:', currentTaskID);
  } else if (context.subtaskID) {
    currentTaskID = context.subtaskID;
    currentTaskName = context.subtaskname;
    console.log('Tracking subtask with ID:', currentTaskID);
  } else {
    currentTaskID = context.taskID;
    currentTaskName = context.taskname;
    console.log('Tracking task with ID:', currentTaskID);
  }

  return { success: true };
});
ipcMain.handle('take-screenshot', async (_, mouse, keyboard) => {
  try {
    return await takeScreenshot(mouse, keyboard);
  } catch (error) {
    console.error('Screenshot IPC failed:', error);
    mainWindow.webContents.send('tracking-error', {
      type: 'api-failure',
      message: error.message
    });
    return { success: false };
  }
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