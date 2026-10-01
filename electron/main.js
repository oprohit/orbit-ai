const { app, BrowserWindow, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const dotenv = require("dotenv");
const { startDesktopAgent, PORT: AGENT_PORT } = require("./desktop-agent");

// Resolve application base path (supports both development and packaged electron app)
const appDir = app.getAppPath ? app.getAppPath() : path.join(__dirname, "..");

// Load local environment files immediately
if (fs.existsSync(path.join(appDir, ".env.local"))) {
  dotenv.config({ path: path.join(appDir, ".env.local") });
}
if (fs.existsSync(path.join(appDir, ".env"))) {
  dotenv.config({ path: path.join(appDir, ".env") });
}

let mainWindow = null;
let agentServer = null;
let localServer = null;
const DEFAULT_LOCAL_PORT = 3000;

function getSplashHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orbit AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0B0B1E;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
      overflow: hidden;
    }
    .container {
      text-align: center;
      animation: fadeIn 0.5s ease-out;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #A78BFA;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 9999px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    .logo-container {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-glow {
      position: absolute;
      inset: -10px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(99, 102, 241, 0) 70%);
      filter: blur(10px);
      border-radius: 50%;
      animation: pulse 2.5s infinite ease-in-out;
    }
    .logo-icon {
      font-size: 52px;
      position: relative;
      z-index: 2;
    }
    .title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #FFFFFF 20%, #A78BFA 60%, #38BDF8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #94A3B8;
      margin-bottom: 32px;
    }
    .spinner-bar {
      width: 220px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 9999px;
      margin: 0 auto;
      overflow: hidden;
      position: relative;
    }
    .spinner-progress {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 40%;
      background: linear-gradient(90deg, #8B5CF6, #38BDF8);
      border-radius: 9999px;
      animation: indeterminate 1.5s infinite ease-in-out;
    }
    .status-text {
      margin-top: 14px;
      font-size: 12px;
      color: #64748B;
    }
    @keyframes indeterminate {
      0% { left: -40%; width: 40%; }
      50% { left: 40%; width: 60%; }
      100% { left: 100%; width: 40%; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.15); opacity: 1; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Standalone Local Software</div>
    <div class="logo-container">
      <div class="logo-glow"></div>
      <div class="logo-icon">🪐</div>
    </div>
    <h1 class="title">Orbit AI</h1>
    <p class="subtitle">Operating System for your Digital Life</p>
    <div class="spinner-bar">
      <div class="spinner-progress"></div>
    </div>
    <div class="status-text">Starting local high-speed engine…</div>
  </div>
</body>
</html>`;
}

async function startLocalNextServer(dir) {
  // If user explicitly configured an external override URL, use it
  if (process.env.ORBIT_DESKTOP_URL) {
    console.log("[Orbit Desktop] Using custom ORBIT_DESKTOP_URL:", process.env.ORBIT_DESKTOP_URL);
    return process.env.ORBIT_DESKTOP_URL;
  }

  const dotNextPath = path.join(dir, ".next");
  if (!fs.existsSync(dotNextPath)) {
    console.warn("[Orbit Desktop] No .next build folder at", dotNextPath, "- falling back to remote URL");
    return "https://orbit-ai-drab.vercel.app";
  }

  try {
    const next = require("next");
    const nextApp = next({
      dev: false,
      dir,
      quiet: true,
    });
    const handle = nextApp.getRequestHandler();

    console.log("[Orbit Desktop] Initializing local Next.js engine...");
    await nextApp.prepare();

    return new Promise((resolve) => {
      const server = http.createServer((req, res) => handle(req, res));

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`[Orbit Desktop] Port ${DEFAULT_LOCAL_PORT} busy, assigning dynamic local port...`);
          const dynServer = http.createServer((req, res) => handle(req, res));
          dynServer.listen(0, "127.0.0.1", () => {
            localServer = dynServer;
            const dynPort = dynServer.address().port;
            console.log(`[Orbit Desktop] High-speed local engine online at http://127.0.0.1:${dynPort}`);
            resolve(`http://127.0.0.1:${dynPort}`);
          });
        } else {
          console.error("[Orbit Desktop] Local server error, falling back to remote:", err);
          resolve("https://orbit-ai-drab.vercel.app");
        }
      });

      server.listen(DEFAULT_LOCAL_PORT, "127.0.0.1", () => {
        localServer = server;
        console.log(`[Orbit Desktop] High-speed local engine online at http://127.0.0.1:${DEFAULT_LOCAL_PORT}`);
        resolve(`http://127.0.0.1:${DEFAULT_LOCAL_PORT}`);
      });
    });
  } catch (err) {
    console.error("[Orbit Desktop] Failed to initialize local Next.js server:", err);
    return "https://orbit-ai-drab.vercel.app";
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
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

  // Display instantaneous local splash screen while local engine initializes
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml())}`);

  // Open external non-local links in the user's default browser (e.g. YouTube Music, Gmail)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Start local server and switch window to local URL
  startLocalNextServer(appDir)
    .then((url) => {
      if (mainWindow) {
        mainWindow.loadURL(url);
      }
    })
    .catch((err) => {
      console.error("[Orbit Desktop] Error loading local URL:", err);
      if (mainWindow) {
        mainWindow.loadURL("https://orbit-ai-drab.vercel.app");
      }
    });
}

// Media and audio flags for Windows
app.commandLine.appendSwitch("enable-speech-dispatcher");
app.commandLine.appendSwitch("enable-features", "AudioServiceOutOfProcess");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(() => {
  // Automatically grant permissions for microphone, audio capture, and notifications
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (["media", "audioCapture", "microphone", "notifications"].includes(permission)) {
      return callback(true);
    }
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  // 1. Start the Windows companion agent (port 38291)
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

app.on("before-quit", () => {
  if (localServer) {
    try {
      localServer.close();
    } catch (e) {}
  }
  if (agentServer) {
    try {
      agentServer.close();
    } catch (e) {}
  }
});
