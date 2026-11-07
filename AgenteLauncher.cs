using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;

namespace AgenteFinanciero
{
    static class Program
    {
        private const string AppUrl = "http://localhost:3001";
        private const string HealthUrl = "http://127.0.0.1:3001/api/health";
        private const string FallbackHealthUrl = "http://localhost:3001/api/portfolio";

        [STAThread]
        static void Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // Handle --stop argument to gracefully stop running server
            if (args.Length > 0 && (args[0] == "--stop" || args[0] == "-stop"))
            {
                StopRunningServer();
                return;
            }

            try
            {
                // 1. Create Desktop shortcut if missing
                CreateDesktopShortcut(baseDir);

                // 2. Check if server is already responding
                bool isRunning = IsServerResponding(HealthUrl, 1000) || IsServerResponding(FallbackHealthUrl, 1000);

                if (!isRunning)
                {
                    // Locate node.exe (>= v22.5 required for native node:sqlite)
                    string nodeExe = FindNodeExecutable(baseDir);
                    if (string.IsNullOrEmpty(nodeExe))
                    {
                        MessageBox.Show(
                            "No se encontró una versión compatible de Node.js (se requiere Node.js v22.5+ o v24+ para soporte nativo de SQLite).\n\n" +
                            "• Si has descargado el código fuente de GitHub, instala Node.js v22 LTS / v24 desde https://nodejs.org\n" +
                            "• O bien ejecuta 'Instalador-Agente-Financiero.exe' que ya incluye su propio motor Node.js v24 integrado.",
                            "Agente Financiero - Node.js Requerido",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return;
                    }

                    string serverScript = Path.Combine(baseDir, "server", "api.mjs");
                    if (!File.Exists(serverScript))
                    {
                        MessageBox.Show(
                            "No se encontró el script del servidor en:\n" + serverScript,
                            "Agente Financiero - Error",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return;
                    }

                    // Auto-setup if user downloaded the GitHub repository ZIP (missing node_modules or dist)
                    string expressModule = Path.Combine(baseDir, "node_modules", "express");
                    string distIndex = Path.Combine(baseDir, "dist", "index.html");
                    if (!Directory.Exists(expressModule) || !File.Exists(distIndex))
                    {
                        bool setupOk = EnsureDependenciesAndBuild(baseDir, Directory.Exists(expressModule), File.Exists(distIndex));
                        if (!setupOk)
                        {
                            return;
                        }
                    }

                    string logFile = Path.Combine(baseDir, "server_error.log");
                    try { if (File.Exists(logFile)) File.Delete(logFile); } catch { }

                    // Launch node server hidden in the background
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = nodeExe,
                        Arguments = "--no-warnings \"" + serverScript + "\"",
                        WorkingDirectory = baseDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardError = true,
                        RedirectStandardOutput = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };

                    Process nodeProc = new Process();
                    nodeProc.StartInfo = psi;
                    nodeProc.ErrorDataReceived += (s, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                        {
                            try { File.AppendAllText(logFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " [STDERR] " + e.Data + Environment.NewLine); } catch { }
                        }
                    };
                    nodeProc.OutputDataReceived += (s, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data) && (e.Data.Contains("Error") || e.Data.Contains("error") || e.Data.Contains("Exception")))
                        {
                            try { File.AppendAllText(logFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " [STDOUT] " + e.Data + Environment.NewLine); } catch { }
                        }
                    };

                    nodeProc.Start();
                    nodeProc.BeginErrorReadLine();
                    nodeProc.BeginOutputReadLine();

                    // Wait up to 25 seconds for server to be responsive
                    int maxRetries = 50;
                    int retry = 0;
                    while (retry < maxRetries && !IsServerResponding(HealthUrl, 600) && !IsServerResponding(FallbackHealthUrl, 600))
                    {
                        if (nodeProc.HasExited)
                        {
                            break;
                        }
                        Thread.Sleep(500);
                        retry++;
                    }

                    if (!IsServerResponding(HealthUrl, 1200) && !IsServerResponding(FallbackHealthUrl, 1200))
                    {
                        string errorDetails = "";
                        if (File.Exists(logFile))
                        {
                            try { errorDetails = File.ReadAllText(logFile); } catch { }
                        }

                        string message = "El servidor de la aplicación no pudo iniciarse correctamente.";
                        if (!string.IsNullOrWhiteSpace(errorDetails))
                        {
                            message += "\n\nDetalle técnico registrado:\n" + (errorDetails.Length > 550 ? errorDetails.Substring(errorDetails.Length - 550) : errorDetails);
                        }
                        else if (nodeProc.HasExited)
                        {
                            message += "\n\nEl proceso de Node.js finalizó prematuramente (Código: " + nodeProc.ExitCode + "). Verifica que tu versión de Node.js sea v22.5+ o v24+.";
                        }
                        else
                        {
                            message += "\nComprueba los registros o intenta arrancar de nuevo.";
                        }

                        MessageBox.Show(
                            message,
                            "Agente Financiero - Error al Iniciar",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return;
                    }
                }

                // 3. Open UI in App Window mode (clean desktop experience without URL bars)
                OpenAppWindow(AppUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Ocurrió un error al iniciar la aplicación:\n\n" + ex.Message,
                    "Agente Financiero - Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static bool EnsureDependenciesAndBuild(string baseDir, bool hasNodeModules, bool hasDist)
        {
            try
            {
                string cmdArgs = "";
                if (!hasNodeModules && !hasDist)
                {
                    cmdArgs = "/c echo ================================================================= && " +
                              "echo [Agente Financiero] Primera ejecucion desde repositorio GitHub && " +
                              "echo Instalando dependencias y compilando interfaz (1-2 minutos)... && " +
                              "echo ================================================================= && " +
                              "npm install && npm run build";
                }
                else if (!hasNodeModules)
                {
                    cmdArgs = "/c echo [Agente Financiero] Instalando dependencias necesarias (npm install)... && npm install";
                }
                else
                {
                    cmdArgs = "/c echo [Agente Financiero] Compilando interfaz grafica (npm run build)... && npm run build";
                }

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = cmdArgs,
                    WorkingDirectory = baseDir,
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Normal
                };

                Process proc = Process.Start(psi);
                proc.WaitForExit();

                string expressModule = Path.Combine(baseDir, "node_modules", "express");
                if (!Directory.Exists(expressModule))
                {
                    MessageBox.Show(
                        "No se pudieron instalar automáticamente las dependencias ('node_modules').\n\n" +
                        "• Si descargaste el código fuente de GitHub, abre una terminal en esta carpeta y ejecuta:\n" +
                        "    npm install\n" +
                        "    npm run build\n\n" +
                        "• O bien ejecuta 'Instalador-Agente-Financiero.exe', que ya incluye todas las dependencias y Node.js v24 listos para usar.",
                        "Agente Financiero - Dependencias Pendientes",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Error preparando las dependencias iniciales:\n" + ex.Message,
                    "Agente Financiero - Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return false;
            }
        }

        private static string FindNodeExecutable(string baseDir)
        {
            // 1. Check local bundled node.exe
            string localNode = Path.Combine(baseDir, "node.exe");
            if (File.Exists(localNode) && IsNodeVersionSupported(localNode)) return localNode;

            // 2. Check local dist-package/node.exe (if running from repo root)
            string distPkgNode = Path.Combine(baseDir, "dist-package", "node.exe");
            if (File.Exists(distPkgNode) && IsNodeVersionSupported(distPkgNode)) return distPkgNode;

            // 3. Check standard Program Files installation
            string pfNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            if (File.Exists(pfNode) && IsNodeVersionSupported(pfNode)) return pfNode;

            string pfx86Node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe");
            if (File.Exists(pfx86Node) && IsNodeVersionSupported(pfx86Node)) return pfx86Node;

            // 4. Check system PATH
            string pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathEnv))
            {
                foreach (string dir in pathEnv.Split(';'))
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(dir)) continue;
                        string cand = Path.Combine(dir.Trim(), "node.exe");
                        if (File.Exists(cand) && IsNodeVersionSupported(cand)) return cand;
                    }
                    catch { }
                }
            }

            return null;
        }

        private static bool IsNodeVersionSupported(string nodePath)
        {
            try
            {
                FileVersionInfo fvi = FileVersionInfo.GetVersionInfo(nodePath);
                // node:sqlite requires Node.js >= 22.5.0
                if (fvi.FileMajorPart > 22) return true;
                if (fvi.FileMajorPart == 22 && fvi.FileMinorPart >= 5) return true;
                return false;
            }
            catch
            {
                return true;
            }
        }

        private static bool IsServerResponding(string url, int timeoutMs)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = timeoutMs;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void OpenAppWindow(string url)
        {
            // Try Microsoft Edge in App Mode (Chromium clean window)
            string edgePaths = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
            if (!File.Exists(edgePaths))
            {
                edgePaths = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe");
            }

            if (File.Exists(edgePaths))
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = edgePaths,
                    Arguments = "--app=" + url + " --window-size=1600,980"
                };
                Process.Start(psi);
                return;
            }

            // Try Google Chrome in App Mode
            string chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe");
            if (!File.Exists(chromePath))
            {
                chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe");
            }

            if (File.Exists(chromePath))
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = chromePath,
                    Arguments = "--app=" + url + " --window-size=1600,980"
                };
                Process.Start(psi);
                return;
            }

            // Fallback: Default Browser
            Process.Start(url);
        }

        private static void StopRunningServer()
        {
            try
            {
                // Kill process on port 3001 using netstat/taskkill
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -Command \"Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                Process p = Process.Start(psi);
                p.WaitForExit(5000);
                MessageBox.Show("El servidor de Agente Financiero se ha detenido.", "Agente Financiero", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al detener servidor: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void CreateDesktopShortcut(string baseDir)
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktop, "Agente Financiero.lnk");
                string exePath = Path.Combine(baseDir, "Agente-Financiero.exe");
                string iconPath = Path.Combine(baseDir, "app_icon.ico");

                if (!File.Exists(exePath)) return;

                // Create shortcut via WScript.Shell
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = exePath;
                    shortcut.WorkingDirectory = baseDir;
                    shortcut.Description = "Agente Financiero - Plataforma Institucional de Análisis y Portafolio";
                    if (File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath + ",0";
                    }
                    shortcut.Save();
                }
            }
            catch
            {
                // Non-critical, ignore if permissions disallow shortcut creation
            }
        }
    }
}
