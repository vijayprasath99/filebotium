const { contextBridge, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPath: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      return (file && file.path) ? file.path : '';
    }
  }
});
