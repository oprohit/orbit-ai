using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace OrbitAI
{
    static class Program
    {
        private static bool IsPortOpen(int port)
        {
            try
            {
                using (var tcp = new TcpClient("127.0.0.1", port))
                {
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        [STAThread]
        static void Main()
        {
            try
            {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

                // Candidate paths for desktop-agent.js
                string[] candidateScripts = new string[]
                {
                    Path.Combine(appDir, "electron", "desktop-agent.js"),
                    Path.Combine(appDir, "OrbitAI", "electron", "desktop-agent.js"),
                    Path.Combine(desktopDir, "OrbitAI", "electron", "desktop-agent.js"),
                    Path.Combine(userProfile, "Desktop", "OrbitAI", "electron", "desktop-agent.js"),
                    @"C:\Users\LN\Desktop\OrbitAI\electron\desktop-agent.js"
                };

                string agentScript = null;
                string workingDir = appDir;
                foreach (var p in candidateScripts)
                {
                    if (File.Exists(p))
                    {
                        agentScript = p;
                        workingDir = Path.GetDirectoryName(Path.GetDirectoryName(p));
                        break;
                    }
                }

                // Candidate paths for node.exe
                string[] candidateNodes = new string[]
                {
                    @"C:\Program Files\nodejs\node.exe",
                    @"C:\Program Files (x86)\nodejs\node.exe",
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "node", "node.exe"),
                    "node.exe"
                };

                string nodeExe = "node.exe";
                foreach (var n in candidateNodes)
                {
                    if (File.Exists(n))
                    {
                        nodeExe = n;
                        break;
                    }
                }

                // 1. Start Desktop Agent companion in the background if not already running
                Process agentProcess = null;
                if (!IsPortOpen(38291) && agentScript != null && File.Exists(agentScript))
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo(nodeExe, "\"" + agentScript + "\"")
                        {
                            CreateNoWindow = true,
                            UseShellExecute = false,
                            WindowStyle = ProcessWindowStyle.Hidden,
                            WorkingDirectory = workingDir
                        };
                        agentProcess = Process.Start(psi);
                        Thread.Sleep(500);
                    }
                    catch { }
                }

                // 2. Launch Dedicated Desktop App Window (Chromium app mode)
                string appUrl = "https://orbit-ai-drab.vercel.app";
                string msedge = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe");
                if (!File.Exists(msedge))
                {
                    msedge = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe");
                }

                string chrome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe");
                if (!File.Exists(chrome))
                {
                    chrome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe");
                }

                Process winProcess = null;
                if (File.Exists(msedge))
                {
                    winProcess = Process.Start(msedge, "--app=" + appUrl + " --window-size=1440,920");
                }
                else if (File.Exists(chrome))
                {
                    winProcess = Process.Start(chrome, "--app=" + appUrl + " --window-size=1440,920");
                }
                else
                {
                    Process.Start(appUrl);
                }

                if (winProcess != null && agentProcess != null)
                {
                    winProcess.WaitForExit();
                    try { if (!agentProcess.HasExited) agentProcess.Kill(); } catch { }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error starting Orbit AI: " + ex.Message, "Orbit AI Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
