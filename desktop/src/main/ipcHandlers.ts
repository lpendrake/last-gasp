import { ipcMain } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function registerIpcHandlers() {
  ipcMain.handle('fs:readDir', async (event, dirPath: string) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      return files.map(file => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        path: path.join(dirPath, file.name)
      }));
    } catch (error) {
      console.error('Failed to read directory:', error);
      return [];
    }
  });

  ipcMain.handle('fs:read', async (event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return null;
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:write', async (event, filePath: string, content: string) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:delete', async (event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  });
}
