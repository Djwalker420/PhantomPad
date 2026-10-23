// PhantomPad — Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('phantompad', {
  platform: process.platform,
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getTrayEnabled: () => ipcRenderer.invoke('get-tray-enabled'),
  setTrayEnabled: (enabled) => ipcRenderer.invoke('set-tray-enabled', Boolean(enabled)),
  getTrayStatus: () => ipcRenderer.invoke('get-tray-status'),
  hideTrayVisualizer: () => ipcRenderer.send('tray-visualizer-hide'),
  openDashboard: () => ipcRenderer.send('dashboard-show')
});
