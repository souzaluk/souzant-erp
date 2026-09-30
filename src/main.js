const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

autoUpdater.logger = log;
// O provider 'github' recebe HTTP 406 ao consultar releases/latest; usa o download direto do latest.yml
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://github.com/souzaluk/souzant-erp/releases/latest/download'
});
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let win = null;
let tray = null;
let updaterWin = null;
let quitting = false;
let startupTimer = null;
let startupCheck = true; // true enquanto a verificação de abertura está em andamento

// Instância única
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', showWindow);

const wasHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;

function iconPath() {
  return path.join(__dirname, '..', 'build', 'icon.png');
}

// ---------- Janela principal ----------
function createWindow() {
  if (win) return;
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    icon: iconPath(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => { if (!wasHidden) win.show(); });
  // Fechar = minimizar para a bandeja (segundo plano)
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---------- Janela de atualização ----------
function openUpdaterWindow() {
  if (wasHidden || updaterWin) return; // início com o Windows: sem janela
  updaterWin = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    center: true,
    icon: iconPath(),
    backgroundColor: '#FFFFFF',
    webPreferences: { preload: path.join(__dirname, 'updater-preload.js'), contextIsolation: true }
  });
  updaterWin.loadFile(path.join(__dirname, 'updater.html'));
  updaterWin.on('closed', () => { updaterWin = null; });
}

function updaterStatus(text, percent, detail = '') {
  if (updaterWin && !updaterWin.isDestroyed()) {
    updaterWin.webContents.send('update-status', { text, percent, detail });
  }
}

function closeUpdaterWindow() {
  if (updaterWin && !updaterWin.isDestroyed()) updaterWin.close();
}

// Encerra a verificação de abertura e segue para o app
function finishStartup() {
  if (!startupCheck) return;
  startupCheck = false;
  closeUpdaterWindow();
  createWindow();
}

// ---------- Bandeja e início com o Windows ----------
function isAutoStart() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
  buildTrayMenu();
}

function buildTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Souzant ERP', click: showWindow },
    { type: 'separator' },
    {
      label: 'Iniciar com o Windows',
      type: 'checkbox',
      checked: isAutoStart(),
      click: (item) => setAutoStart(item.checked)
    },
    { label: 'Verificar atualizações', click: () => checkUpdates(true) },
    { type: 'separator' },
    { label: `Versão ${app.getVersion()}`, enabled: false },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 }));
  tray.setToolTip('Souzant ERP');
  tray.on('click', showWindow);
  buildTrayMenu();
}

// ---------- Atualizações ----------
let manualCheck = false;
function checkUpdates(manual = false) {
  if (!app.isPackaged) { finishStartup(); return; }
  manualCheck = manual;
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Update check failed', err);
    finishStartup();
  });
}

autoUpdater.on('checking-for-update', () => {
  if (startupCheck) updaterStatus('Buscando atualizações...', null);
});
autoUpdater.on('update-available', (info) => {
  log.info('Nova versão encontrada', info.version);
  clearTimeout(startupTimer); // download em andamento: não fecha a janela por tempo
  if (tray) tray.setToolTip(`Souzant ERP - baixando v${info.version}...`);
  if (startupCheck) updaterStatus(`Baixando a versão ${info.version}`, 0);
});
autoUpdater.on('download-progress', (p) => {
  if (!startupCheck) return;
  const mb = (n) => (n / 1048576).toFixed(1);
  updaterStatus(`Baixando a atualização`, p.percent, `${mb(p.transferred)} de ${mb(p.total)} MB`);
});
autoUpdater.on('update-not-available', () => {
  if (manualCheck && win) dialog.showMessageBox(win, { message: 'Você já está na versão mais recente.' });
  finishStartup();
});
autoUpdater.on('error', (err) => {
  log.error('Erro no updater', err);
  finishStartup();
});
autoUpdater.on('update-downloaded', (info) => {
  // Instala e reinicia ao concluir o download
  log.info('Atualização baixada, instalando', info.version);
  if (startupCheck) updaterStatus('Instalando a atualização...', 100, 'O aplicativo será reiniciado');
  quitting = true;
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
});

app.whenReady().then(() => {
  createTray();
  openUpdaterWindow();
  checkUpdates();                                   // ao abrir
  startupTimer = setTimeout(finishStartup, 20000);  // segurança: não trava se a rede não responder
  setInterval(() => checkUpdates(), 4 * 60 * 60 * 1000); // e a cada 4h em segundo plano
});

// Mantém o app vivo na bandeja
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; });
