import { ipcMain, dialog, app, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import pkg from 'electron-updater';
import { generateShortId } from '../shared/ids.js';
import { buildEntityIndex } from './entity-index.js';
import { registerTimelineIpcHandlers } from './timelineIpcHandlers.js';
import { registerEntityIndexHandlers } from './entity-index-handlers.js';
import { ensureEventTemplate, readTemplate } from './event-template.js';
import {
  getWorkspaceDefaultTheme,
  setWorkspaceDefaultTheme,
  getCampaignTheme,
  setCampaignTheme,
  getCampaignOverrides,
} from './theme-settings.js';

const { autoUpdater } = pkg;

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

  // File Selection
  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
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

  // Theme Settings
  ipcMain.handle('themeSettings:getWorkspaceDefault', (_event, rootDir: string) =>
    getWorkspaceDefaultTheme(rootDir),
  );

  ipcMain.handle('themeSettings:setWorkspaceDefault', (_event, rootDir: string, themeId: string) =>
    setWorkspaceDefaultTheme(rootDir, themeId),
  );

  ipcMain.handle('themeSettings:getCampaign', (_event, campaignPath: string) =>
    getCampaignTheme(campaignPath),
  );

  ipcMain.handle(
    'themeSettings:setCampaign',
    (_event, campaignPath: string, themeId: string | null) =>
      setCampaignTheme(campaignPath, themeId),
  );

  ipcMain.handle('themeSettings:getCampaignOverrides', (_event, campaignPaths: string[]) =>
    getCampaignOverrides(campaignPaths),
  );

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
            const { data, content: body } = matter(content);

            let id = data.id;
            if (!id) {
              id = generateShortId();
              const updatedContent = matter.stringify(body, { ...data, id });
              fs.writeFileSync(configPath, updatedContent, 'utf-8');
            }

            campaigns.push({
              id,
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
        ensureEventTemplate(campaignPath);

        // Create campaign.md with frontmatter
        const id = generateShortId();
        const configContent = `---
id: ${id}
name: ${name}
description: ${description}
---

${description}
`;
        fs.writeFileSync(path.join(campaignPath, 'campaign.md'), configContent);
        fs.writeFileSync(
          path.join(campaignPath, 'timeline', 'state.json'),
          JSON.stringify({ in_game_now: '', campaign_start: '' }, null, 2),
        );

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

  ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Failed to create directory:', error);
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

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (!/^(?:https?|mailto):/i.test(url)) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
    try {
      const normalized = path.resolve(filePath);
      if (fs.existsSync(normalized)) {
        shell.showItemInFolder(normalized);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to show item in folder:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:trash', async (event, filePath: string) => {
    try {
      const normalized = path.resolve(filePath);
      if (fs.existsSync(normalized)) {
        await shell.trashItem(normalized);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to trash item:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:rename', async (event, oldPath: string, newPath: string) => {
    try {
      if (fs.existsSync(oldPath)) {
        const dir = path.dirname(newPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.renameSync(oldPath, newPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to rename:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:writeBuffer', async (event, filePath: string, buffer: Uint8Array) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return true;
    } catch (error) {
      console.error('Failed to write buffer:', error);
      throw error;
    }
  });

  ipcMain.handle('entity:buildIndex', async (event, campaignPath: string) => {
    try {
      return buildEntityIndex(campaignPath);
    } catch (error) {
      console.error('Failed to build entity index:', error);
      return [];
    }
  });

  ipcMain.handle('notes:ensureDirs', async (event, notesDir: string) => {
    try {
      const dirs = ['player characters', 'factions', 'locations', 'npcs', 'plots'];
      for (const dir of dirs) {
        const fullPath = path.join(notesDir, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to ensure note directories:', error);
      return false;
    }
  });

  registerTimelineIpcHandlers();
  registerEntityIndexHandlers();

  ipcMain.handle('template:read', async (_event, campaignPath: string, name: string) =>
    readTemplate(campaignPath, name),
  );

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:installUpdate', async () => {
    await autoUpdater.downloadUpdate();
  });
}
