import * as fs from 'node:fs';
import * as path from 'node:path';
import { BrowserWindow } from 'electron';
import * as chokidar from 'chokidar';
import { indexSingleFile, ASSET_EXTENSIONS } from './linkIndex.js';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private campaignPath = '';

  public async start(campaignPath: string, mainWindow: BrowserWindow) {
    this.stop();
    this.campaignPath = campaignPath;

    if (!fs.existsSync(campaignPath)) {
      fs.mkdirSync(campaignPath, { recursive: true });
    }

    this.watcher = chokidar.watch(campaignPath, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
      // Prevents duplicate events on Windows when editors write files in stages.
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    this.watcher
      .on('add', (filePath: string) => {
        mainWindow.webContents.send('fs:changed', { event: 'add', path: filePath });
        this.pushIndexDelta(filePath, 'add', mainWindow);
      })
      .on('change', (filePath: string) => {
        mainWindow.webContents.send('fs:changed', { event: 'change', path: filePath });
        this.pushIndexDelta(filePath, 'update', mainWindow);
      })
      .on('unlink', (filePath: string) => {
        mainWindow.webContents.send('fs:changed', { event: 'unlink', path: filePath });
        const rel = path.relative(this.campaignPath, filePath).replace(/\\/g, '/');
        const ext = path.extname(filePath).toLowerCase();
        const tracked = ext === '.md' || ASSET_EXTENSIONS.has(ext);
        if (tracked && (rel.startsWith('notes/') || rel.startsWith('timeline/'))) {
          mainWindow.webContents.send('notes:indexDelta', { op: 'remove', path: rel });
        }
      });

    console.log(`[FileWatcher] Started watching ${campaignPath}`);
  }

  private pushIndexDelta(filePath: string, op: 'add' | 'update', mainWindow: BrowserWindow) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.md' && !ASSET_EXTENSIONS.has(ext)) return;
    const entry = indexSingleFile(filePath, this.campaignPath);
    if (!entry) return;
    mainWindow.webContents.send('notes:indexDelta', { op, entry });
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
