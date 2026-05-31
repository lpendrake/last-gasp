import * as fs from 'node:fs';
import * as path from 'node:path';

function readJsonObject(file: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeJsonObject(file: string, obj: Record<string, unknown>): void {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf-8');
}

export function getWorkspaceDefaultTheme(rootDir: string): string | null {
  try {
    const file = path.join(rootDir, 'settings.json');
    const obj = readJsonObject(file);
    const value = obj.defaultTheme;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function setWorkspaceDefaultTheme(rootDir: string, themeId: string): void {
  const file = path.join(rootDir, 'settings.json');
  const obj = readJsonObject(file);
  obj.defaultTheme = themeId;
  writeJsonObject(file, obj);
}

export function getCampaignTheme(campaignPath: string): string | null {
  try {
    const file = path.join(campaignPath, 'settings.json');
    const obj = readJsonObject(file);
    const value = obj.theme;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCampaignTheme(campaignPath: string, themeId: string | null): void {
  const file = path.join(campaignPath, 'settings.json');

  if (themeId === null) {
    // If file doesn't exist, do nothing
    if (!fs.existsSync(file)) {
      return;
    }
    const obj = readJsonObject(file);
    delete obj.theme;
    writeJsonObject(file, obj);
    return;
  }

  const obj = readJsonObject(file);
  obj.theme = themeId;
  writeJsonObject(file, obj);
}

export function getCampaignOverrides(campaignPaths: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const campaignPath of campaignPaths) {
    try {
      const theme = getCampaignTheme(campaignPath);
      if (theme !== null) {
        result[campaignPath] = theme;
      }
    } catch {
      // skip paths that error
    }
  }
  return result;
}
