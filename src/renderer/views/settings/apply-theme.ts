import { ThemeProvider } from '../../theme';
import { themeSettingsData } from './theme-settings-data';
import { resolveActiveThemeId } from './domain/resolve-active-theme';

function validThemeIds(): string[] {
  return ThemeProvider.listThemes().map((t) => t.id);
}

export async function applyWorkspaceDefaultTheme(rootDir: string): Promise<void> {
  const workspaceDefault = await themeSettingsData.getWorkspaceDefaultTheme(rootDir);
  ThemeProvider.setByName(
    resolveActiveThemeId({
      campaignOverride: null,
      workspaceDefault,
      validThemeIds: validThemeIds(),
    }),
  );
}

export async function applyCampaignTheme(rootDir: string, campaignPath: string): Promise<void> {
  const [workspaceDefault, campaignOverride] = await Promise.all([
    themeSettingsData.getWorkspaceDefaultTheme(rootDir),
    themeSettingsData.getCampaignTheme(campaignPath),
  ]);
  ThemeProvider.setByName(
    resolveActiveThemeId({ campaignOverride, workspaceDefault, validThemeIds: validThemeIds() }),
  );
}
