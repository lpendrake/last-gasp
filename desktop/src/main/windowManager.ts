import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  public createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      show: false, // Create hidden to avoid a "flicker" while maximizing
      autoHideMenuBar: true, // Clean "App" look, press Alt to show it
      icon: path.join(app.getAppPath(), 'src/assets/images/TTT.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(app.getAppPath(), 'dist/preload/index.cjs'),
      },
    });

    this.mainWindow.maximize();
    this.mainWindow.show();

    const isDev = !app.isPackaged;

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      this.mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }

    return this.mainWindow;
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

export const windowManager = new WindowManager();
