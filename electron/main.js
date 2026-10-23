const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

function logApp(msg) {
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'PhantomPad_debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

let mainWindow = null;
let trayWindow = null;
let tray = null;
let server = null;
let trayEnabled = true;

const DEFAULT_PORT = 3000;
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
    trayEnabled = settings.trayVisualizerEnabled !== false;
  } catch (_) {
    trayEnabled = true;
  }
}

function saveSettings() {
  try {
    const file = SETTINGS_FILE();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ trayVisualizerEnabled: trayEnabled }, null, 2));
  } catch (error) {
    logApp(`Could not save settings: ${error.message}`);
  }
}

function showDashboard() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createWindow() {
  logApp('Starting createWindow()...');
  try {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#0a0d14',
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#0a0d14', symbolColor: '#edf3f6', height: 36 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: true,
      autoHideMenuBar: true
    });
    logApp('BrowserWindow created successfully');
  } catch (error) {
    logApp(`CRITICAL ERROR in BrowserWindow creation: ${error.message}`);
    logApp(error.stack);
    return;
  }

  const activePort = server ? server.activePort : DEFAULT_PORT;
  mainWindow.loadURL(`http://localhost:${activePort}/dashboard`).catch((error) => {
    logApp(`Dashboard load failed: ${error.message}`);
  });

  mainWindow.on('close', (event) => {
    if (trayEnabled && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide();
      logApp('Main window hidden; server continues in tray.');
      return;
    }
    app.isQuitting = true;
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTrayWindow() {
  if (trayWindow && !trayWindow.isDestroyed()) return trayWindow;
  trayWindow = new BrowserWindow({
    width: 360,
    height: 390,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  trayWindow.loadFile(path.join(__dirname, 'tray-visualizer.html'));
  trayWindow.on('blur', () => trayWindow?.hide());
  trayWindow.on('closed', () => { trayWindow = null; });
  return trayWindow;
}

function toggleTrayVisualizer() {
  if (!trayEnabled) return;
  const popup = createTrayWindow();
  if (popup.isVisible()) {
    popup.hide();
    return;
  }
  const bounds = tray?.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(bounds ? bounds.x + bounds.width / 2 : 0),
    y: Math.round(bounds ? bounds.y + bounds.height / 2 : 0)
  });
  const area = display.workArea;
  const width = 360;
  const height = 390;
  const x = Math.max(area.x, Math.min(area.x + area.width - width, bounds ? bounds.x + bounds.width - width : area.x + area.width - width));
  const trayBelowCenter = bounds && bounds.y + bounds.height / 2 > area.y + area.height / 2;
  const y = trayBelowCenter ? bounds.y - height - 8 : bounds.y + bounds.height + 8;
  popup.setBounds({ x, y: Math.max(area.y, Math.min(area.y + area.height - height, y)), width, height });
  popup.show();
  popup.focus();
}

function destroyTray() {
  if (trayWindow && !trayWindow.isDestroyed()) trayWindow.close();
  trayWindow = null;
  if (tray) {
    try { tray.destroy(); } catch (_) {}
    tray = null;
  }
}

function createTray() {
  if (!trayEnabled || tray) return;
  logApp('Starting tray visualizer...');
  const iconPath = path.join(__dirname, 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip('PhantomPad — Live Controller Status');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Live Input Visualizer', click: toggleTrayVisualizer },
    { label: 'Open Dashboard', click: showDashboard },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${server.activePort}`) },
    { label: 'Copy Controller URL', click: () => require('electron').clipboard.writeText(server.getControllerUrl()) },
    { type: 'separator' },
    { label: 'Quit PhantomPad', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', toggleTrayVisualizer);
  tray.on('double-click', showDashboard);
  logApp('Tray visualizer ready.');
}

function registerIpcHandlers() {
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('tray-visualizer-hide', () => trayWindow?.hide());
  ipcMain.on('dashboard-show', showDashboard);
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('get-tray-enabled', () => trayEnabled);
  ipcMain.handle('set-tray-enabled', (_event, enabled) => {
    trayEnabled = Boolean(enabled);
    saveSettings();
    if (trayEnabled) createTray();
    else destroyTray();
    logApp(`Tray visualizer ${trayEnabled ? 'enabled' : 'disabled'} from the dashboard.`);
    return trayEnabled;
  });
  ipcMain.handle('get-tray-status', () => server?.getTrayStatus?.() || {
    mode: 'gamepad', gamepadAvailable: false, gamepadError: 'Starting PhantomPad…', players: []
  });
}

function startServer() {
  logApp('Starting PhantomPad server...');
  try {
    server = require('../server/index.js');
    const openWindows = () => {
      createWindow();
      createTray();
    };
    if (server.httpServer.listening) openWindows();
    else server.httpServer.once('listening', openWindows);
  } catch (error) {
    logApp(`FATAL ERROR requiring server: ${error.message}`);
    logApp(error.stack);
    console.error('Failed to start server:', error);
  }
}

logApp('--- APP SCRIPT STARTED ---');
app.whenReady().then(() => {
  readSettings();
  registerIpcHandlers();
  startServer();
});

app.on('window-all-closed', () => {
  if (!trayEnabled) app.quit();
});

app.on('activate', () => showDashboard());

app.on('before-quit', () => {
  app.isQuitting = true;
  logApp('App quitting — cleaning up server and tray.');
  if (server?.shutdown) server.shutdown();
  else if (server?.httpServer) {
    try { server.httpServer.close(); } catch (_) {}
  }
  destroyTray();
});
