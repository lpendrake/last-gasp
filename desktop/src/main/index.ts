import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { windowManager } from './windowManager.js';
import { registerIpcHandlers } from './ipcHandlers.js';
import { FileWatcher } from './fileWatcher.js';

const TARGET_DIR = 'C:\\Users\\lauri\\Google Drive\\tabletop-timeline';
const fileWatcher = new FileWatcher(TARGET_DIR);

app.whenReady().then(async () => {
  registerIpcHandlers();

  const mainWindow = windowManager.createMainWindow();
  await fileWatcher.start(mainWindow);

  // Automatically check for updates silently
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  fileWatcher.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
