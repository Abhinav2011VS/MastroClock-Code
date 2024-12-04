const { app, BrowserWindow, ipcMain, Menu, Tray, globalShortcut } = require('electron');
const path = require('path');

// Initialize store for local settings
let Store;
(async () => {
  Store = (await import('electron-store')).default;
  const store = new Store();

  // Globals for windows
  let mainWindow;
  let clockWindow;
  let tray;

  // Function to create main window
  function createMainWindow() {
    if (mainWindow) {
      mainWindow.focus();
      return;
    }

    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      autoHideMenuBar: true,
      resizable: false,
      icon: path.join(__dirname, 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        enableRemoteModule: false,
      },
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // Function to create clock window
  function createClockWindow() {
    const { width, height, x, y } = store.get('clockPosition', {
      width: 220,
      height: 130,
      x: 100,
      y: 100,
    });

    clockWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,  // Disables window frame to allow transparency
      transparent: true,  // Ensures the window is transparent
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,      
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    clockWindow.loadFile('clock.html');

    // Save position and size on close
    clockWindow.on('close', () => {
      const bounds = clockWindow.getBounds();
      store.set('clockPosition', bounds);
    });

    clockWindow.on('closed', () => {
      clockWindow = null;
    });
  }

  // Function to initialize tray
  function initializeTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Main Window',
        click: createMainWindow,
      },
      {
        label: 'Toggle Clock',
        click: () => {
          if (clockWindow) {
            clockWindow.close();
          } else {
            createClockWindow();
          }
        },
      },
      {
        label: 'Switch Theme',
        submenu: [
          {
            label: 'Light Mode',
            type: 'radio',
            checked: store.get('theme', 'light') === 'light',
            click: () => updateTheme('light'),
          },
          {
            label: 'Dark Mode',
            type: 'radio',
            checked: store.get('theme', 'light') === 'dark',
            click: () => updateTheme('dark'),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);

    tray.setToolTip('Mastro Clock');
    tray.setContextMenu(contextMenu);
  }

  // Function to update theme
  function updateTheme(theme) {
    store.set('theme', theme);
    if (clockWindow) {
      clockWindow.webContents.send('update-theme', theme);
    }
  }

  // Initialize global shortcuts
  function initializeShortcuts() {
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (clockWindow) {
        clockWindow.close();
      } else {
        createClockWindow();
      }
    });
  }

  // Enable startup on boot
  function enableAutoLaunch() {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }

  // App initialization
  app.whenReady().then(() => {
    createMainWindow();
    createClockWindow();
    initializeTray();
    initializeShortcuts();
    enableAutoLaunch();

    app.on('activate', () => {
      if (!mainWindow) createMainWindow();
    });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
})();
