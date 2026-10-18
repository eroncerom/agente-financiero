using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Drawing;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;

namespace AgenteFinancieroInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private TextBox txtInstallDir;
        private Button btnBrowse;
        private Button btnInstall;
        private ProgressBar progressBar;
        private Label lblStatus;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private CheckBox chkLaunchAfter;
        private bool isFinished = false;
        private string targetDir;

        public InstallerForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Instalador de Agente Financiero v1.0.0";
            this.Size = new Size(640, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(11, 14, 20); // #0B0E14
            this.ForeColor = Color.FromArgb(248, 250, 252); // #F8FAFC
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            // Try load icon
            try
            {
                using (Stream iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("AppPayload.zip"))
                {
                    // Icon embedded via /win32icon
                    this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                }
            }
            catch { }

            // Header Banner
            Panel headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 85,
                BackColor = Color.FromArgb(18, 24, 36) // #121824
            };

            Label lblTitle = new Label
            {
                Text = "Agente Financiero - Instalación",
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248), // #38BDF8 Sky Blue
                Location = new Point(25, 18),
                AutoSize = true
            };

            Label lblSubtitle = new Label
            {
                Text = "Terminal Institucional de Apoyo a Decisiones Financieras & Gestión de Cartera",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184), // #94A3B8
                Location = new Point(26, 48),
                AutoSize = true
            };

            headerPanel.Controls.Add(lblTitle);
            headerPanel.Controls.Add(lblSubtitle);
            this.Controls.Add(headerPanel);

            // Body Container
            Panel bodyPanel = new Panel
            {
                Location = new Point(25, 105),
                Size = new Size(575, 275)
            };

            Label lblDesc = new Label
            {
                Text = "Este asistente instalará la plataforma en su equipo con su motor de valoración, base de datos local y universos de mercado (S&P 500, NASDAQ 100, IBEX 35).\n\nLa aplicación se configurará en un estado inicial limpio (\"sin datos\"), listo para registrar sus propias operaciones e inversiones.",
                Location = new Point(0, 0),
                Size = new Size(575, 65),
                ForeColor = Color.FromArgb(226, 232, 240)
            };
            bodyPanel.Controls.Add(lblDesc);

            // Destination Folder Group
            Label lblFolder = new Label
            {
                Text = "Carpeta de instalación de destino:",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(0, 75),
                AutoSize = true
            };
            bodyPanel.Controls.Add(lblFolder);

            string defaultPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgenteFinanciero");
            txtInstallDir = new TextBox
            {
                Text = defaultPath,
                Location = new Point(0, 100),
                Width = 475,
                BackColor = Color.FromArgb(22, 31, 48),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            bodyPanel.Controls.Add(txtInstallDir);

            btnBrowse = new Button
            {
                Text = "Examinar...",
                Location = new Point(485, 98),
                Width = 90,
                Height = 27,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(56, 189, 248);
            btnBrowse.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Seleccione la carpeta donde desea instalar Agente Financiero";
                    fbd.SelectedPath = txtInstallDir.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtInstallDir.Text = fbd.SelectedPath;
                    }
                }
            };
            bodyPanel.Controls.Add(btnBrowse);

            // Shortcuts Options
            chkDesktopShortcut = new CheckBox
            {
                Text = "Crear acceso directo en el Escritorio",
                Checked = true,
                Location = new Point(0, 140),
                AutoSize = true,
                ForeColor = Color.FromArgb(226, 232, 240)
            };
            bodyPanel.Controls.Add(chkDesktopShortcut);

            chkStartMenuShortcut = new CheckBox
            {
                Text = "Añadir al Menú Inicio de Windows",
                Checked = true,
                Location = new Point(0, 168),
                AutoSize = true,
                ForeColor = Color.FromArgb(226, 232, 240)
            };
            bodyPanel.Controls.Add(chkStartMenuShortcut);

            chkLaunchAfter = new CheckBox
            {
                Text = "Iniciar Agente Financiero al finalizar la instalación",
                Checked = true,
                Location = new Point(0, 196),
                AutoSize = true,
                ForeColor = Color.FromArgb(250, 204, 21) // Gold accent
            };
            bodyPanel.Controls.Add(chkLaunchAfter);

            // Progress Bar
            progressBar = new ProgressBar
            {
                Location = new Point(0, 232),
                Size = new Size(575, 14),
                Visible = false,
                Style = ProgressBarStyle.Marquee
            };
            bodyPanel.Controls.Add(progressBar);

            lblStatus = new Label
            {
                Text = "Listo para iniciar la instalación.",
                Location = new Point(0, 250),
                Size = new Size(575, 20),
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Italic)
            };
            bodyPanel.Controls.Add(lblStatus);

            this.Controls.Add(bodyPanel);

            // Bottom Actions Panel
            Panel bottomPanel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 55,
                BackColor = Color.FromArgb(18, 24, 36)
            };

            btnInstall = new Button
            {
                Text = "Instalar Ahora",
                Location = new Point(485, 12),
                Size = new Size(130, 32),
                BackColor = Color.FromArgb(56, 189, 248),
                ForeColor = Color.FromArgb(11, 14, 20),
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Click += BtnInstall_Click;

            Button btnCancel = new Button
            {
                Text = "Cancelar",
                Location = new Point(390, 12),
                Size = new Size(85, 32),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(226, 232, 240),
                FlatStyle = FlatStyle.Flat
            };
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btnCancel.Click += (s, e) => { this.Close(); };

            bottomPanel.Controls.Add(btnCancel);
            bottomPanel.Controls.Add(btnInstall);
            this.Controls.Add(bottomPanel);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            if (isFinished)
            {
                if (chkLaunchAfter.Checked && !string.IsNullOrEmpty(targetDir))
                {
                    string exePath = Path.Combine(targetDir, "Agente-Financiero.exe");
                    if (File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = exePath,
                            WorkingDirectory = targetDir
                        });
                    }
                }
                this.Close();
                return;
            }

            targetDir = txtInstallDir.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                MessageBox.Show("Por favor seleccione una carpeta de instalación válida.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnInstall.Enabled = false;
            btnBrowse.Enabled = false;
            txtInstallDir.Enabled = false;
            chkDesktopShortcut.Enabled = false;
            chkStartMenuShortcut.Enabled = false;
            progressBar.Visible = true;
            lblStatus.Text = "Extrayendo archivos y componentes de la plataforma...";

            Thread installThread = new Thread(() =>
            {
                try
                {
                    PerformInstallation(targetDir);

                    this.Invoke((MethodInvoker)delegate
                    {
                        progressBar.Visible = false;
                        lblStatus.Text = "¡Instalación completada exitosamente!";
                        lblStatus.ForeColor = Color.FromArgb(16, 185, 129); // Green
                        btnInstall.Text = "Finalizar";
                        btnInstall.BackColor = Color.FromArgb(16, 185, 129);
                        btnInstall.Enabled = true;
                        isFinished = true;
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        progressBar.Visible = false;
                        lblStatus.Text = "Error durante la instalación: " + ex.Message;
                        lblStatus.ForeColor = Color.FromArgb(239, 68, 68); // Red
                        btnInstall.Enabled = true;
                        btnInstall.Text = "Reintentar";
                    });
                }
            });

            installThread.IsBackground = true;
            installThread.Start();
        }

        private void PerformInstallation(string destination)
        {
            if (!Directory.Exists(destination))
            {
                Directory.CreateDirectory(destination);
            }

            // 1. Extract embedded payload zip
            Assembly assembly = Assembly.GetExecutingAssembly();
            using (Stream resourceStream = assembly.GetManifestResourceStream("AppPayload.zip"))
            {
                if (resourceStream == null)
                {
                    // If not embedded as AppPayload.zip, look for adjacent app_package.zip
                    string adjacentZip = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app_package.zip");
                    if (File.Exists(adjacentZip))
                    {
                        using (FileStream fs = File.OpenRead(adjacentZip))
                        using (ZipArchive archive = new ZipArchive(fs, ZipArchiveMode.Read))
                        {
                            ExtractArchive(archive, destination);
                        }
                    }
                    else
                    {
                        throw new FileNotFoundException("No se encontró el paquete de recursos de instalación (AppPayload.zip).");
                    }
                }
                else
                {
                    using (ZipArchive archive = new ZipArchive(resourceStream, ZipArchiveMode.Read))
                    {
                        ExtractArchive(archive, destination);
                    }
                }
            }

            // 2. Create Uninstaller script
            string uninstallerBat = Path.Combine(destination, "Desinstalar.bat");
            File.WriteAllText(uninstallerBat, 
                "@echo off\r\n" +
                "title Desinstalar Agente Financiero\r\n" +
                "echo Esta seguro de que desea desinstalar Agente Financiero? (S/N)\r\n" +
                "set /p opt=\r\n" +
                "if /i \"%opt%\" neq \"S\" exit\r\n" +
                "echo Cerrando procesos...\r\n" +
                "taskkill /f /im node.exe >nul 2>&1\r\n" +
                "echo Eliminando accesos directos...\r\n" +
                "del \"%USERPROFILE%\\Desktop\\Agente Financiero.lnk\" >nul 2>&1\r\n" +
                "del \"%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Agente Financiero.lnk\" >nul 2>&1\r\n" +
                "echo Eliminando archivos...\r\n" +
                "timeout /t 2 >nul\r\n" +
                "cd ..\r\n" +
                "rmdir /s /q \"" + destination + "\"\r\n" +
                "echo Desinstalacion completada.\r\n" +
                "pause\r\n"
            );

            // 3. Create Shortcuts
            string exePath = Path.Combine(destination, "Agente-Financiero.exe");
            string iconPath = Path.Combine(destination, "app_icon.ico");

            if (chkDesktopShortcut.Checked)
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                CreateShortcut(Path.Combine(desktopPath, "Agente Financiero.lnk"), exePath, destination, iconPath);
            }

            if (chkStartMenuShortcut.Checked)
            {
                string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                CreateShortcut(Path.Combine(startMenu, "Agente Financiero.lnk"), exePath, destination, iconPath);
            }
        }

        private void ExtractArchive(ZipArchive archive, string destination)
        {
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string completeFileName = Path.Combine(destination, entry.FullName);
                string directory = Path.GetDirectoryName(completeFileName);

                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                if (string.IsNullOrEmpty(entry.Name))
                {
                    continue; // Directory entry
                }

                entry.ExtractToFile(completeFileName, true);
            }
        }

        private void CreateShortcut(string shortcutLocation, string targetPath, string workingDir, string iconPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutLocation);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = "Agente Financiero - Plataforma Institucional de Análisis y Portafolio";
                    if (File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath + ",0";
                    }
                    shortcut.Save();
                }
            }
            catch { }
        }
    }
}
