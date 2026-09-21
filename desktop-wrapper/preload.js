const { contextBridge, webUtils, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPath: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      return (file && file.path) ? file.path : '';
    }
  },
  revealInFolder: (filePath) => ipcRenderer.invoke('reveal-in-folder', filePath),
  moveToTrash: (filePath) => ipcRenderer.invoke('move-to-trash', filePath)
});
