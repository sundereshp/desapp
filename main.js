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

async function takeScreenshot() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 } // Adjust size as needed
    });

    const now = new Date();
    // Create a timestamp rounded down to the nearest minute
    const minuteTimestamp = new Date(now);
    minuteTimestamp.setSeconds(0, 0);
    const minuteFolder = minuteTimestamp.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 16);
    
    const screenshotDir = path.join(
      'C:/Users/Sunderesh/OneDrive/Pictures/usertracking',
      'screenshots',
      minuteFolder
    );

    // Ensure directory exists
    fs.mkdirSync(screenshotDir, { recursive: true });

    const screenshotPath = path.join(
      screenshotDir,
      `screenshot-${now.getTime()}.png`
    );

    // Save the screenshot
    fs.writeFileSync(
      screenshotPath,
      sources[0].thumbnail.toPNG()
    );

    console.log('Screenshot saved to:', screenshotPath);
    return { success: true, path: screenshotPath };
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
    sendGlobalEvent({
      type: 'mouseclick',
      button: event.button,
      x: event.x,
      y: event.y
    });
  });

  // Key press event
  uIOhook.on('keydown', (event) => {
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
ipcMain.handle('take-screenshot', takeScreenshot);
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
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