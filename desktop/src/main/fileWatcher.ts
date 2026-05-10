import * as fs from 'node:fs';
import { BrowserWindow } from 'electron';
import * as chokidar from 'chokidar';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  constructor() {}

  public async start(targetDir: string, mainWindow: BrowserWindow) {
    this.stop(); // Ensure old watcher is stopped

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    this.watcher = chokidar.watch(targetDir, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher!.on('add', (filePath: string) =>
      mainWindow.webContents.send('fs:changed', { event: 'add', path: filePath }),
    )
      .on('change', (filePath: string) =>
        mainWindow.webContents.send('fs:changed', { event: 'change', path: filePath }),
      )
      .on('unlink', (filePath: string) =>
        mainWindow.webContents.send('fs:changed', { event: 'unlink', path: filePath }),
      );

    console.log(`[FileWatcher] Started watching ${targetDir}`);
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
