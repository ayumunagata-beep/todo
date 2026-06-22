const { contextBridge, ipcRenderer } = require('electron');

// レンダラー側に安全なAPIだけを公開する
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('todos:load'),
  save: (todos) => ipcRenderer.invoke('todos:save', todos),
  close: () => ipcRenderer.send('app:close'),
});
