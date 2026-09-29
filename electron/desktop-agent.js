const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

const PORT = 38291;

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function scanFolder(folderPath, maxDepth = 2, currentDepth = 0) {
  let totalBytes = 0;
  let fileCount = 0;
  const largeFiles = [];

  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      try {
        if (entry.isFile()) {
          const stats = await fs.promises.stat(fullPath);
          totalBytes += stats.size;
          fileCount++;
          if (stats.size > 50 * 1024 * 1024) {
            largeFiles.push({
              name: entry.name,
              path: fullPath,
              size: formatBytes(stats.size),
              bytes: stats.size,
            });
          }
        } else if (entry.isDirectory() && currentDepth < maxDepth) {
          const sub = await scanFolder(fullPath, maxDepth, currentDepth + 1);
          totalBytes += sub.totalBytes;
          fileCount += sub.fileCount;
          largeFiles.push(...sub.largeFiles);
        }
      } catch (err) {
        // Skip unreadable files
      }
    }
  } catch (err) {
    // Skip unreadable folder
  }

  return { totalBytes, fileCount, largeFiles: largeFiles.slice(0, 10) };
}

function startDesktopAgent() {
  const server = http.createServer(async (req, res) => {
    // Allow CORS from Vercel, Netlify, and localhost
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/status" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          running: true,
          agent: "Orbit Desktop Agent",
          version: "1.0.0",
          platform: process.platform,
          hostname: os.hostname(),
          username: os.userInfo().username,
          homeDir: os.homedir(),
          tempDir: os.tmpdir(),
        })
      );
      return;
    }

    if (url.pathname === "/scan" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const home = os.homedir();
          const target = parsed.target || "downloads";

          let scanPath = path.join(home, "Downloads");
          if (target === "temp") scanPath = os.tmpdir();
          if (target === "documents") scanPath = path.join(home, "Documents");
          if (target === "desktop") scanPath = path.join(home, "Desktop");

          const result = await scanFolder(scanPath);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              scannedPath: scanPath,
              totalFormatted: formatBytes(result.totalBytes),
              totalBytes: result.totalBytes,
              fileCount: result.fileCount,
              largeFiles: result.largeFiles,
              summary: `Scanned ${scanPath} — found ${result.fileCount} files (${formatBytes(
                result.totalBytes
              )})`,
            })
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/mkdir" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const folderName = (parsed.folderName || "NewFolder").replace(/[<>:"/\\|?*]/g, "_");
          const location = (parsed.location || "desktop").toLowerCase();
          const home = os.homedir();

          let targetDir = path.join(home, "Desktop");
          if (location === "documents") targetDir = path.join(home, "Documents");
          if (location === "downloads") targetDir = path.join(home, "Downloads");
          if (parsed.customPath) targetDir = parsed.customPath;

          const finalPath = path.join(targetDir, folderName);
          await fs.promises.mkdir(finalPath, { recursive: true });

          if (parsed.openInExplorer) {
            exec(`explorer "${finalPath}"`);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              folderName,
              path: finalPath,
              summary: `Created folder "${folderName}" at ${finalPath}`,
            })
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/mail" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const to = encodeURIComponent(parsed.to || "");
          const subject = encodeURIComponent(parsed.subject || "");
          const mailBody = encodeURIComponent(parsed.body || "");

          const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${mailBody}`;
          exec(`start "" "${gmailUrl}"`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              gmailUrl,
              summary: `Opened compose draft to ${parsed.to || "recipient"}`,
            })
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/open" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const targetPath = parsed.path || os.homedir();
          exec(`explorer "${targetPath}"`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, opened: targetPath }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[Orbit Desktop Agent] Local companion running at http://127.0.0.1:${PORT}`);
  });

  return server;
}

module.exports = { startDesktopAgent, PORT };

if (require.main === module) {
  startDesktopAgent();
}
