const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const { startDesktopAgent, PORT } = require("./desktop-agent");

let mainWindow = null;
let agentServer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0B0B1E",
    title: "Orbit AI — Operating System for your Digital Life",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load the live production Orbit AI app
  const appUrl = process.env.ORBIT_DESKTOP_URL || "https://orbit-ai-drab.vercel.app";
  mainWindow.loadURL(appUrl);

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.commandLine.appendSwitch("enable-speech-dispatcher");
app.commandLine.appendSwitch("enable-features", "AudioServiceOutOfProcess");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(() => {
  // Grant microphone, media, and notification permissions automatically
  const { session } = require("electron");
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (["media", "audioCapture", "microphone", "notifications"].includes(permission)) {
      return callback(true);
    }
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });

  // 1. Start the local Windows companion agent
  try {
    agentServer = startDesktopAgent();
  } catch (err) {
    console.error("Failed to start desktop agent:", err);
  }

  // 2. Open desktop window
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
