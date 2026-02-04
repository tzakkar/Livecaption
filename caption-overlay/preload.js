const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captionOverlay", {
  openOverlay: (viewerUrl) => ipcRenderer.invoke("open-overlay", viewerUrl),
  getEmbedBaseUrl: () => ipcRenderer.invoke("get-embed-url"),
});
