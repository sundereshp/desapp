const { contextBridge, ipcRenderer } = require('electron');

// Debug log to verify preload script is running
console.log('Preload script running');

// Expose the electronAPI to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Debug method to test if API is exposed
  testConnection: () => 'Electron API is working!',

  // Tracking controls
  startTracking: () => ipcRenderer.invoke('start-tracking'),
  stopTracking: () => ipcRenderer.invoke('stop-tracking'),
  getTrackingStatus: () => ipcRenderer.invoke('get-tracking-status'),
  // Add this to the contextBridge.exposeInMainWorld object
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  // Event listeners
  onGlobalEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('global-event', handler);
    return () => ipcRenderer.removeListener('global-event', handler);
  },

  // Cleanup
  removeGlobalEventListener: (callback) => {
    ipcRenderer.removeListener('global-event', callback);
  },

  onTrackingStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('tracking-status', handler);
    return () => ipcRenderer.removeListener('tracking-status', handler);
  },

  onTrackingError: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('tracking-error', handler);
    return () => ipcRenderer.removeListener('tracking-error', handler);
  },
});

// Add a property to window to verify preload is working
window.electronPreload = 'Preload script loaded successfully';