import { ipcMain, dialog, app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function getSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read config:', e);
  }
  return {};
}

function saveSettings(settings: Record<string, unknown>) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function registerIpcHandlers() {
  // Directory Selection
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // Settings
  ipcMain.handle('settings:getRootDir', async () => {
    return getSettings().rootDir || null;
  });

  ipcMain.handle('settings:setRootDir', async (event, rootDir: string) => {
    const settings = getSettings();
    settings.rootDir = rootDir;
    saveSettings(settings);
  });

  // Campaign Management
  ipcMain.handle('campaign:scan', async (event, rootDir: string) => {
    try {
      if (!fs.existsSync(rootDir)) return [];
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      const campaigns = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const campaignPath = path.join(rootDir, entry.name);
          const configPath = path.join(campaignPath, 'campaign.md');

          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            const { data } = matter(content);
            campaigns.push({
              name: data.name || entry.name,
              description: data.description || '',
              folderName: entry.name,
              path: campaignPath,
            });
          }
        }
      }
      return campaigns;
    } catch (error) {
      console.error('Failed to scan campaigns:', error);
      return [];
    }
  });

  ipcMain.handle(
    'campaign:create',
    async (event, rootDir: string, name: string, description: string) => {
      try {
        const folderName = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_');
        const campaignPath = path.join(rootDir, folderName);

        if (fs.existsSync(campaignPath)) {
          return { success: false, error: 'A campaign with this name already exists' };
        }

        // Create directory structure
        fs.mkdirSync(campaignPath, { recursive: true });
        fs.mkdirSync(path.join(campaignPath, 'notes'), { recursive: true });
        fs.mkdirSync(path.join(campaignPath, 'timeline'), { recursive: true });
        fs.mkdirSync(path.join(campaignPath, 'relationships'), { recursive: true });

        // Create campaign.md with frontmatter
        const configContent = `---
name: ${name}
description: ${description}
---

${description}
`;
        fs.writeFileSync(path.join(campaignPath, 'campaign.md'), configContent);

        return { success: true, path: campaignPath };
      } catch (error: unknown) {
        console.error('Failed to create campaign:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
        };
      }
    },
  );

  // File System Handlers
  ipcMain.handle('fs:readDir', async (event, dirPath: string) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      return files.map((file) => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        path: path.join(dirPath, file.name),
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
