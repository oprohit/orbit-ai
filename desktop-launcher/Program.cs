using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace OrbitAI
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string agentScript = Path.Combine(appDir, "electron", "desktop-agent.js");
                
                // 1. Start Desktop Agent companion in the background
                Process agentProcess = null;
                if (File.Exists(agentScript))
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo("node.exe", "\"" + agentScript + "\"")
                        {
                            CreateNoWindow = true,
                            UseShellExecute = false,
                            WindowStyle = ProcessWindowStyle.Hidden,
                            WorkingDirectory = appDir
                        };
                        agentProcess = Process.Start(psi);
                    }
                    catch { }
                }

                // 2. Launch Dedicated Desktop App Window
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
                    winProcess = Process.Start(msedge, "--app=" + appUrl + " --window-size=1420,920");
                }
                else if (File.Exists(chrome))
                {
                    winProcess = Process.Start(chrome, "--app=" + appUrl + " --window-size=1420,920");
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
