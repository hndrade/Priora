const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  init: () => ipcRenderer.invoke('init'),
  refresh: () => ipcRenderer.invoke('refresh'),
  setToken: (token) => ipcRenderer.invoke('set-token', token),
  cyclePoll: () => ipcRenderer.invoke('cycle-poll'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  setOpacity: (value) => ipcRenderer.invoke('set-opacity', value),
  quit: () => ipcRenderer.invoke('quit'),
  onUsage: (cb) => ipcRenderer.on('usage', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
  onPolling: (cb) => ipcRenderer.on('polling', () => cb()),
});
