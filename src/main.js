const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let win = null;
let tray = null;
let quitting = false;

// Instância única
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', showWindow);

const wasHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;

function iconPath() {
  return path.join(__dirname, '..', 'build', 'icon.png');
}

function createWindow() {
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

let manualCheck = false;
function checkUpdates(manual = false) {
  if (!app.isPackaged) return;
  manualCheck = manual;
  autoUpdater.checkForUpdates().catch((err) => log.error('Update check failed', err));
}

autoUpdater.on('update-available', (info) => {
  log.info('Nova versão encontrada', info.version);
  if (tray) tray.setToolTip(`Souzant ERP - baixando v${info.version}...`);
});
autoUpdater.on('update-not-available', () => {
  if (manualCheck && win) dialog.showMessageBox(win, { message: 'Você já está na versão mais recente.' });
});
autoUpdater.on('update-downloaded', (info) => {
  // Instala e reinicia imediatamente ao encontrar nova versão
  log.info('Atualização baixada, instalando', info.version);
  quitting = true;
  autoUpdater.quitAndInstall(true, true);
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  checkUpdates();                                   // ao abrir
  setInterval(checkUpdates, 4 * 60 * 60 * 1000);    // e a cada 4h em segundo plano
});

// Mantém o app vivo na bandeja
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; });
