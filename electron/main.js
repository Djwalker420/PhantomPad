const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function logApp(msg) {
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const logPath = path.join(dir, 'PhantomPad_debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(e) {}
}

let mainWindow = null;
let tray = null;
let server = null;

const PORT = 3000;

function createWindow() {
  logApp('Starting createWindow()...');
  try {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#06060c',
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#06060c',
        symbolColor: '#e8e8f0',
        height: 36
      },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: true,
      autoHideMenuBar: true
    });
    logApp('BrowserWindow created successfully');
  } catch (e) {
    logApp(`CRITICAL ERROR in BrowserWindow creation: ${e.message}`);
    logApp(e.stack);
    return;
  }

  const activePort = server ? server.activePort : PORT;
  logApp(`Loading URL: http://localhost:${activePort}/dashboard`);
  
  mainWindow.loadURL(`http://localhost:${activePort}/dashboard`).then(() => {
    logApp('loadURL completed successfully');
  }).catch(e => {
    logApp(`loadURL FAILED: ${e.message}`);
  });

  mainWindow.once('ready-to-show', () => {
    logApp('Event: ready-to-show fired');
    // mainWindow.show() is omitted since show is true
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  logApp('Starting createTray()...');
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
    logApp('Tray icon created');
  } catch (e) {
    logApp(`Warning: Tray nativeImage failed: ${e.message}`);
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('PhantomPad — Game Controller');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '⚡ PhantomPad',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Open in Browser',
      click: () => shell.openExternal(`http://localhost:${server.activePort}`)
    },
    { type: 'separator' },
    {
      label: 'Copy Controller URL',
      click: () => {
        const { clipboard } = require('electron');
        clipboard.writeText(`http://localhost:${server.activePort}/controller`);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit PhantomPad',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function startServer() {
  logApp('Starting startServer()...');
  try {
    logApp('Requiring server/index.js...');
    server = require('../server/index.js');
    logApp('Server file required. Waiting for listening event...');
    
    // Wait for the server to successfully find and bind to a port
    if (server.httpServer.listening) {
      logApp(`Server is ALREADY listening. Active port: ${server.activePort}`);
      createWindow();
      createTray();
    } else {
      server.httpServer.once('listening', () => {
        logApp(`Server listening event fired. Active port: ${server.activePort}`);
        createWindow();
        createTray();
      });
    }
  } catch (e) {
    logApp(`FATAL ERROR requiring server: ${e.message}`);
    logApp(e.stack);
    console.error('Failed to start server:', e);
  }
}

logApp('--- APP SCRIPT STARTED ---');
app.whenReady().then(() => {
  logApp('app.whenReady() fired');
  startServer();
});

app.on('window-all-closed', () => {
  // Don't quit on macOS (not needed since we focus Android, but good practice)
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
