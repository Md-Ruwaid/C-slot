const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onSlotsUpdate: (callback) => {
    ipcRenderer.on('slots', (_event, value) => callback(value));
  },
  getState: () => ipcRenderer.invoke('get_state')
});
