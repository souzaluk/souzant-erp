const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('app', { platform: process.platform });
