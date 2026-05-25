import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { windowManager } from './windowManager.js';
import { registerIpcHandlers } from './ipcHandlers.js';
import { FileWatcher } from './fileWatcher.js';
import { getCampaignPath, setCampaignPath } from './campaign-state.js';
import { CampaignLoader } from './campaign-loader.js';
import { buildEntityIndex } from './entity-index.js';
import type { EntityIndexEntry } from './entity-index.js';

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

const fileWatcher = new FileWatcher();
registerIpcHandlers();

app.whenReady().then(() => {
  // URL shape: notes-asset://current/notes/<folder>/assets/<file>
  protocol.handle('notes-asset', (request) => {
    if (!getCampaignPath()) {
      return new Response('No campaign open', { status: 404 });
    }
    const url = new URL(request.url);
    const relPath = decodeURIComponent(url.pathname.slice(1)); // strip leading /
    const campaignBase = path.resolve(getCampaignPath()!);
    const resolved = path.resolve(campaignBase, relPath);
    if (!resolved.startsWith(campaignBase + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).href);
  });

  const mainWindow = windowManager.createMainWindow();

  ipcMain.handle('campaign:open', async (event, campaignPath: string) => {
    const resolvedPath = path.resolve(campaignPath);
    setCampaignPath(resolvedPath);
    await fileWatcher.start(campaignPath, mainWindow);

    let entityIndex: EntityIndexEntry[] = [];
    const loader = new CampaignLoader([
      {
        name: 'Building entity index',
        task: async (onProgress) => {
          entityIndex = buildEntityIndex(resolvedPath, onProgress);
        },
      },
    ]);

    try {
      await loader.run(event.sender);
      return { success: true, entityIndex };
    } catch (err) {
      setCampaignPath(null);
      fileWatcher.stop();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('campaign:close', async () => {
    setCampaignPath(null);
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
