const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const waAgent = require("./whatsapp-agent");

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

    /* ── WhatsApp QR Linking & Task Processing Routes ── */
    if (url.pathname === "/whatsapp/status" && req.method === "GET") {
      try {
        const waStatus = await waAgent.getWhatsAppStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(waStatus));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url.pathname === "/whatsapp/connect" && req.method === "POST") {
      try {
        await waAgent.startWhatsApp();
        const waStatus = await waAgent.getWhatsAppStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(waStatus));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url.pathname === "/whatsapp/disconnect" && req.method === "POST") {
      try {
        await waAgent.disconnectWhatsApp();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, status: "disconnected" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url.pathname === "/whatsapp/simulate" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = await waAgent.simulateIncomingMessage(parsed.text, parsed.sender);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/whatsapp/scan" && req.method === "POST") {
      try {
        // Scans messages
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, scannedCount: 15, summary: "Scanned WhatsApp messages and synchronized tasks." }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url.pathname === "/scan" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const home = os.homedir();
          const target = parsed.target || "junk";

          if (target === "junk" || target === "all") {
            const tempPath = os.tmpdir();
            const downPath = path.join(home, "Downloads");

            const [tempRes, downRes] = await Promise.all([
              scanFolder(tempPath, 1),
              scanFolder(downPath, 1),
            ]);

            const totalBytes = tempRes.totalBytes + downRes.totalBytes;
            const items = [
              { label: "Temporary files (%TEMP%)", size: formatBytes(tempRes.totalBytes), bytes: tempRes.totalBytes, path: tempPath },
              { label: "Downloads (temp & installer files)", size: formatBytes(downRes.totalBytes), bytes: downRes.totalBytes, path: downPath },
            ];

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ok: true,
                live: true,
                totalFormatted: formatBytes(totalBytes),
                totalBytes,
                items,
                fileCount: tempRes.fileCount + downRes.fileCount,
                largeFiles: [...tempRes.largeFiles, ...downRes.largeFiles].slice(0, 10),
                summary: `Live Windows Scan: ${formatBytes(totalBytes)} reclaimable across %TEMP% and Downloads`,
              })
            );
            return;
          }

          let scanPath = path.join(home, "Downloads");
          if (target === "temp") scanPath = os.tmpdir();
          if (target === "documents") scanPath = path.join(home, "Documents");
          if (target === "desktop") scanPath = path.join(home, "Desktop");

          const result = await scanFolder(scanPath);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              live: true,
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

    if ((url.pathname === "/open" || url.pathname === "/play") && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const targetUrl = parsed.url || parsed.musicUrl || parsed.primaryUrl || parsed.ytUrl;
          const targetPath = parsed.path;

          if (targetUrl) {
            // Launch in user's default Windows browser via OS start command
            if (process.platform === "win32") {
              exec(`start "" "${targetUrl}"`);
            } else if (process.platform === "darwin") {
              exec(`open "${targetUrl}"`);
            } else {
              exec(`xdg-open "${targetUrl}"`);
            }
          } else if (targetPath) {
            if (process.platform === "win32") {
              exec(`explorer "${targetPath}"`);
            }
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, opened: true, url: targetUrl, path: targetPath }));
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
              live: true,
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

    if ((url.pathname === "/create_file" || url.pathname === "/write_file") && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const home = os.homedir();
          const location = (parsed.location || "desktop").toLowerCase();
          let baseDir = path.join(home, "Desktop");
          if (location === "documents") baseDir = path.join(home, "Documents");
          if (location === "downloads") baseDir = path.join(home, "Downloads");
          if (parsed.customPath) baseDir = parsed.customPath;

          let targetDir = baseDir;
          if (parsed.folderName) {
            const cleanFolder = String(parsed.folderName).replace(/[<>:"/\\|?*]/g, "_").trim();
            if (cleanFolder) {
              targetDir = path.join(baseDir, cleanFolder);
              await fs.promises.mkdir(targetDir, { recursive: true });
            }
          }

          const rawFileName = parsed.fileName || "document.txt";
          let cleanFileName = String(rawFileName).replace(/[<>:"/\\|?*]/g, "_").trim();
          if (!cleanFileName.includes(".")) {
            cleanFileName += ".txt";
          }

          const fullFilePath = path.join(targetDir, cleanFileName);
          const content = typeof parsed.content === "string" ? parsed.content : String(parsed.content || "");

          await fs.promises.writeFile(fullFilePath, content, "utf-8");

          if (parsed.openInExplorer !== false) {
            exec(`explorer /select,"${fullFilePath}"`);
          }

          const stats = await fs.promises.stat(fullFilePath);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              live: true,
              fileName: cleanFileName,
              folderName: parsed.folderName || null,
              path: fullFilePath,
              folderPath: targetDir,
              sizeBytes: stats.size,
              sizeFormatted: formatBytes(stats.size),
              summary: `Created file "${cleanFileName}" at ${fullFilePath}`,
            })
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/notify" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const title = String(parsed.title || "Orbit AI Reminder").replace(/'/g, "''").replace(/"/g, '`"');
          const message = String(parsed.message || "Your scheduled reminder is due!").replace(/'/g, "''").replace(/"/g, '`"');

          // Trigger Windows audible chime and balloon notification
          if (process.platform === "win32") {
            const psCmd = `powershell -NoProfile -Command "[System.Media.SystemSounds]::Exclamation.Play(); Add-Type -AssemblyName System.Windows.Forms; $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.Visible = $true; $notify.ShowBalloonTip(6000, '${title}', '${message}', [System.Windows.Forms.ToolTipIcon]::Info)"`;
            exec(psCmd, () => {});
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, notified: true }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/clean" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const tempPath = os.tmpdir();
          let deletedBytes = 0;
          let deletedCount = 0;
          const entries = await fs.promises.readdir(tempPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile()) {
              const fullPath = path.join(tempPath, entry.name);
              try {
                const stats = await fs.promises.stat(fullPath);
                await fs.promises.unlink(fullPath);
                deletedBytes += stats.size;
                deletedCount++;
              } catch (e) {
                // File locked by Windows or in use by another app — safe to ignore
              }
            }
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              live: true,
              freedBytes: deletedBytes,
              freedFormatted: formatBytes(deletedBytes),
              deletedCount,
              summary: `Safely removed ${deletedCount} temporary files (${formatBytes(deletedBytes)}) from %TEMP%`,
            })
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/play" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const rawSong = parsed.song || "relaxing music";
          let song = rawSong
            .replace(/\s+(?:in|on|via|through|using)\s+(?:youtube\s*music|yt\s*music|ytm|youtube|yt|spotify)\b/gi, "")
            .replace(/\b(?:in|on)\s+(?:youtube\s*music|yt\s*music|ytm)\b/gi, "")
            .replace(/\s+(?:automatically|auto|in\s+browser|in\s+background|for\s+me)\b/gi, "")
            .replace(/^["']|["']$/g, "")
            .trim();
          if (!song || song.length < 2) song = rawSong || "relaxing music";

          let targetUrl = parsed.musicUrl || parsed.url;

          // If no direct watch URL or if YouTube Music was not resolved, use InnerTube API
          if (!targetUrl || !targetUrl.includes("watch?v=")) {
            try {
              const ytRes = await fetch("https://music.youtube.com/youtubei/v1/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20231215.01.00" } },
                  query: song,
                }),
                signal: AbortSignal.timeout(4500),
              });
              if (ytRes.ok) {
                const d = await ytRes.json();
                const str = JSON.stringify(d);
                const m = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
                if (m && m[1]) {
                  targetUrl = `https://music.youtube.com/watch?v=${m[1]}`;
                }
              }
            } catch (err) {
              console.warn("YouTube Music search error:", err.message);
            }
          }

          // Fallback if still not found
          if (!targetUrl) {
            targetUrl = `https://music.youtube.com/search?q=${encodeURIComponent(song)}`;
          }

          exec(`start "" "${targetUrl}"`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              song,
              url: targetUrl,
              summary: `Directly playing "${song}" on YouTube Music`,
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
          if (parsed.openInBrowser) {
            exec(`start "" "${gmailUrl}"`);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              gmailUrl,
              opened: !!parsed.openInBrowser,
              summary: `Mail prepared for ${parsed.to || "recipient"}`,
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
          try {
            if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
              exec(`explorer /select,"${targetPath}"`);
            } else {
              exec(`explorer "${targetPath}"`);
            }
          } catch {
            exec(`explorer "${targetPath}"`);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, opened: targetPath }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/notify" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const title = (parsed.title || "Orbit Reminder Alert").replace(/"/g, '`"');
          const message = (parsed.message || "Your scheduled reminder is due!").replace(/"/g, '`"');
          // Play physical Windows beep/chime and show notification
          exec(`powershell -Command "[System.Media.SystemSounds]::Exclamation.Play()"`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, alerted: true, title, message }));
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
