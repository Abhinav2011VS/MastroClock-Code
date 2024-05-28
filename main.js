const { app, BrowserWindow, ipcMain, Menu, Tray } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Function to initialize auto-updates
function initAutoUpdater() {
  autoUpdater.autoDownload = true; // Automatically download updates
  autoUpdater.allowPrerelease = false; // Do not allow prerelease updates by default

  // Specify the repository for auto-updates
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Abhinav2011VS',
    repo: 'MastroClock',
    // Specify the target platform and architecture (optional)
    platform: process.platform,
    arch: process.arch
  });

  // Check for updates
  autoUpdater.checkForUpdates();

  // Listen for update available event
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('autoUpdateNotification', 'update-available');
  });

  // Listen for update downloaded event
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('autoUpdateNotification', 'update-downloaded');
  });

  // Listen for error event
  autoUpdater.on('error', (error) => {
    mainWindow.webContents.send('autoUpdateNotification', 'realerror', error);
  });
}

// Open channel to listen for update actions
ipcMain.on('autoUpdateAction', (event, arg, data) => {
  switch (arg) {
    case 'initAutoUpdater':
      console.log('Initializing auto updater.');
      initAutoUpdater();
      event.sender.send('autoUpdateNotification', 'ready');
      break;
    case 'checkForUpdate':
      autoUpdater.checkForUpdates()
        .catch(err => {
          event.sender.send('autoUpdateNotification', 'realerror', err);
        });
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

app.whenReady().then(() => {
  // Initialize auto-updater
  initAutoUpdater();

  // Create the main window
  createMainWindow();

  // Create the clock window
  createClockWindow();

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
          clockWindow = null; // Reset clockWindow reference
        }
      }
    },
    {
      label: 'Start Clock',
      click: () => {
        if (!clockWindow) {
          createClockWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Mastro Clock');
  tray.setContextMenu(contextMenu);
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
