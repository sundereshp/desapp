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

// Update the tracking interval to 5 minutes (300,000 ms)
const SCREENSHOT_INTERVAL = 5 * 60 * 1000;

async function takeScreenshot() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().workAreaSize
    });

    const now = new Date();
    
    // Format: YYYY-MM-DD
    const dateFolder = now.toISOString().split('T')[0];
    
    // Create hour interval string (e.g., "14-15")
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;
    const hourInterval = `${currentHour.toString().padStart(2, '0')}-${nextHour.toString().padStart(2, '0')}`;
    
    const screenshotDir = path.join(
      __dirname,
      'public',
      'screenshots',
      dateFolder
    );

    // Ensure directory exists
    fs.mkdirSync(screenshotDir, { recursive: true });

    // Format: screenshot-YYYY-MM-DD-HH-MM-SS.png
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_');
    const screenshotPath = path.join(
      screenshotDir,
      `screenshot-${timestamp}.png`
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
  
  // Set up interval for screenshots (every 5 minutes)
  trackingInterval = setInterval(takeScreenshot, SCREENSHOT_INTERVAL);

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
ipcMain.handle('take-screenshot', takeScreenshot);
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