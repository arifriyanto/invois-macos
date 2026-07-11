// Bridge between the sandboxed renderer and the main process.
// contextIsolation is ON — the renderer never touches Node directly.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vault", {
  status: () => ipcRenderer.invoke("vault:status"),
  pick: () => ipcRenderer.invoke("vault:pick"),
  write: () => ipcRenderer.invoke("vault:write"),
  read: () => ipcRenderer.invoke("vault:read"),
  forget: () => ipcRenderer.invoke("vault:forget"),
  reveal: () => ipcRenderer.invoke("vault:reveal"),
});
