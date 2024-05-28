const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

// Requirements
const { app, BrowserWindow, ipcMain, Menu, Tray, shell } = require('electron');
const autoUpdater = require('electron-updater').autoUpdater;
const ejse = require('ejs-electron');
const fs = require('fs');
const isDev = require('./isdev');
const path = require('path');
const semver = require('semver');
const { pathToFileURL } = require('url');
const AutoLaunch = require('auto-launch');
const settings = require('electron-settings');

// Setup auto updater.
function initAutoUpdater(event, data) {

  if (data) {
    autoUpdater.allowPrerelease = true;
  } else {
    // Defaults to true if application version contains prerelease components (e.g. 0.12.1-alpha.1)
    // autoUpdater.allowPrerelease = true;
  }

  if (isDev) {
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');
  }
  if (process.platform === 'darwin') {
    autoUpdater.autoDownload = false;
  }
  autoUpdater.on('update-available', (info) => {
    event.sender.send('autoUpdateNotification', 'update-available', info);
  });
  autoUpdater.on('update-downloaded', (info) => {
    event.sender.send('autoUpdateNotification', 'update-downloaded', info);
  });
  autoUpdater.on('update-not-available', (info) => {
    event.sender.send('autoUpdateNotification', 'update-not-available', info);
  });
  autoUpdater.on('checking-for-update', () => {
    event.sender.send('autoUpdateNotification', 'checking-for-update');
  });
  autoUpdater.on('error', (err) => {
    event.sender.send('autoUpdateNotification', 'realerror', err);
  });
}

// Open channel to listen for update actions.
ipcMain.on('autoUpdateAction', (event, arg, data) => {
  switch (arg) {
    case 'initAutoUpdater':
      console.log('Initializing auto updater.');
      initAutoUpdater(event, data);
      event.sender.send('autoUpdateNotification', 'ready');
      break;
    case 'checkForUpdate':
      autoUpdater.checkForUpdates()
        .catch(err => {
          event.sender.send('autoUpdateNotification', 'realerror', err);
        });
      break;
    case 'allowPrereleaseChange':
      if (!data) {
        const preRelComp = semver.prerelease(app.getVersion());
        if (preRelComp != null && preRelComp.length > 0) {
          autoUpdater.allowPrerelease = true;
        } else {
          autoUpdater.allowPrerelease = data;
        }
      } else {
        autoUpdater.allowPrerelease = data;
      }
      break;
    case 'installUpdateNow':
      autoUpdater.quitAndInstall();
      break;
    default:
      console.log('Unknown argument', arg);
      break;
  }
});
// Redirect distribution index event from preloader to renderer.
ipcMain.on('distributionIndexDone', (event, res) => {
  event.sender.send('distributionIndexDone', res);
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let clockWindow;
let tray;

// Create an AutoLaunch instance
const autoLauncher = new AutoLaunch({
  name: 'Mastro Clock',
  path: app.getPath('exe'),
});

async function createMainWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: false,
    frame: true,
    resizable: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function createClockWindow() {
  const clockWindowWidth = 220;
  const clockWindowHeight = 130;
  clockWindow = new BrowserWindow({
    width: clockWindowWidth,
    height: clockWindowHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  clockWindow.loadFile('clock.html');
  clockWindow.setIgnoreMouseEvents(true);

  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const screenWidth = display.bounds.width;
  const screenHeight = display.bounds.height;

  const offsetX = 0; // Adjust as needed
  const offsetYPercentage = 0.05; // Adjust to move the clock window up, 0.95 means 95% from the top

  const offsetY = Math.floor(screenHeight * (1 - offsetYPercentage) - clockWindowHeight); // Calculate the offsetY based on percentage

  clockWindow.setPosition(screenWidth - clockWindowWidth + offsetX, offsetY);

  clockWindow.on('closed', () => {
    clockWindow = null;
  });
}

app.whenReady().then(async () => {
  const Store = (await import('electron-store')).default; // Dynamic import
  const store = new Store();

  // Always create the main window when the app is ready
  createMainWindow();

  if (store.get('showClock', true)) {
    createClockWindow();
  }

  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Main Window',
      click: () => {
        createMainWindow();
      }
    },
    {
      label: 'Restart Clock',
      click: () => {
        if (clockWindow) {
          clockWindow.close();
          createClockWindow();
        }
      }
    },
    {
      label: 'Close Clock',
      click: () => {
        if (clockWindow) {
          clockWindow.close();
        }
      }
    },
    {
      label: 'Start Clock',
      enabled: !clockWindow,
      click: () => {
        if (!clockWindow) {
          createClockWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Enable Auto Launch',
      type: 'checkbox',
      checked: store.get('autoLaunch', false),
      click: (menuItem) => {
        const enabled = menuItem.checked;
        store.set('autoLaunch', enabled);
        if (enabled) {
          autoLauncher.enable();
        } else {
          autoLauncher.disable();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Mastro Clock');
  tray.setContextMenu(contextMenu);

  // Enable auto-launch if it was previously enabled
  if (store.get('autoLaunch', false)) {
    autoLauncher.enable();
  }
});

ipcMain.on('update-settings', async (event, settings) => {
  const Store = (await import('electron-store')).default; // Dynamic import
  const store = new Store();
  store.set(settings);
  if (clockWindow) {
    clockWindow.webContents.send('settings-changed', settings);
  }
  if (!clockWindow && settings.showClock) {
    createClockWindow();
  } else if (clockWindow && !settings.showClock) {
    clockWindow.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
