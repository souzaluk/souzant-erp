const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('updater', {
  onStatus: (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data))
});
