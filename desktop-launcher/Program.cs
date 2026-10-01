using System;
using System.Diagnostics;
using System.IO;
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
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

                // Candidates for native standalone OrbitAI.exe
                string[] nativeCandidates = new string[]
                {
                    Path.Combine(appDir, "dist", "OrbitAI-win32-x64", "OrbitAI.exe"),
                    Path.Combine(desktopDir, "OrbitAI", "dist", "OrbitAI-win32-x64", "OrbitAI.exe"),
                    @"C:\Users\LN\Desktop\OrbitAI\dist\OrbitAI-win32-x64\OrbitAI.exe"
                };

                foreach (var exe in nativeCandidates)
                {
                    if (File.Exists(exe))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo(exe)
                        {
                            WorkingDirectory = Path.GetDirectoryName(exe),
                            UseShellExecute = true
                        };
                        Process.Start(psi);
                        return;
                    }
                }

                // Fallback: If dist not found, launch via npm run desktop in repository folder
                string repoDir = Directory.Exists(Path.Combine(appDir, "electron")) ? appDir : Path.Combine(desktopDir, "OrbitAI");
                if (Directory.Exists(repoDir))
                {
                    ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c npm run desktop")
                    {
                        WorkingDirectory = repoDir,
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    return;
                }

                MessageBox.Show("Could not locate native OrbitAI.exe. Please ensure the dist folder is present.", "Orbit AI Launcher", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error starting Orbit AI: " + ex.Message, "Orbit AI Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
