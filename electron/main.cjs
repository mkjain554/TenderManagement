const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const { registerIpc } = require('./ipc.cjs');
const { createDatabase } = require('./database.cjs');

let mainWindow;
let database;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#f5f7fa',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://127.0.0.1:5173');
  }
}

app.whenReady().then(() => {
  const dataDirectory = path.join(app.getPath('userData'), 'data');
  database = createDatabase(dataDirectory);
  registerIpc(database, dataDirectory, {
    onDatabaseReplaced(nextDatabase) {
      database = nextDatabase;
    },
    onProgress(progress) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('data:progress', progress);
      }
    },
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => database?.close());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
