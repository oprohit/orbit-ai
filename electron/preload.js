const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orbitDesktop", {
  isDesktop: true,
  platform: "win32",
  agentPort: 38291,
});
