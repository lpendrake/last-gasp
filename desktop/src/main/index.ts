import { app, BrowserWindow, ipcMain } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { windowManager } from './windowManager.js';
import { registerIpcHandlers } from './ipcHandlers.js';
import { FileWatcher } from './fileWatcher.js';

const fileWatcher = new FileWatcher();
registerIpcHandlers();

app.whenReady().then(() => {
  const mainWindow = windowManager.createMainWindow();

  ipcMain.handle('campaign:open', async (event, campaignPath: string) => {
    await fileWatcher.start(campaignPath, mainWindow);
    return true;
  });

  ipcMain.handle('campaign:close', async () => {
    fileWatcher.stop();
    return true;
  });

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
