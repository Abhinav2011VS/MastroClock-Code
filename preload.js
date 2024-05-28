const { contextBridge, ipcRenderer, remote } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  updateSettings: (settings) => ipcRenderer.send('update-settings', settings),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', callback),
  closeClockWindow: () => ipcRenderer.send('close-clock-window'),
});