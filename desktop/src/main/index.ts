import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { windowManager } from './windowManager.js';
import { registerIpcHandlers } from './ipcHandlers.js';
import { FileWatcher } from './fileWatcher.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'notes-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
]);

let currentCampaignPath: string | null = null;

const fileWatcher = new FileWatcher();
registerIpcHandlers();

app.whenReady().then(() => {
  // URL shape: notes-asset://current/notes/<folder>/assets/<file>
  protocol.handle('notes-asset', (request) => {
    if (!currentCampaignPath) {
      return new Response('No campaign open', { status: 404 });
    }
    const url = new URL(request.url);
    const relPath = decodeURIComponent(url.pathname.slice(1)); // strip leading /
    const campaignBase = path.resolve(currentCampaignPath);
    const resolved = path.resolve(campaignBase, relPath);
    if (!resolved.startsWith(campaignBase + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).href);
  });

  const mainWindow = windowManager.createMainWindow();

  ipcMain.handle('campaign:open', async (event, campaignPath: string) => {
    currentCampaignPath = path.resolve(campaignPath);
    await fileWatcher.start(campaignPath, mainWindow);
    return true;
  });

  ipcMain.handle('campaign:close', async () => {
    currentCampaignPath = null;
    fileWatcher.stop();
    return true;
  });

  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    const notes =
      typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? (info.releaseNotes as { note: string }[]).map((r) => r.note).join('\n')
          : '';
    mainWindow.webContents.send('app:updateAvailable', {
      version: info.version,
      releaseNotes: notes,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
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
