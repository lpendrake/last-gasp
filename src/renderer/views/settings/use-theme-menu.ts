import { useEffect, useState } from 'react';
import type { Campaign } from '../../../types/global';
import { ThemeProvider } from '../../theme';
import { themeSettingsData } from './theme-settings-data';
import {
  buildCampaignThemeRows,
  buildThemeOptionGroups,
  USE_DEFAULT,
  type CampaignThemeRow,
  type CoreThemeOption,
} from './domain/theme-options';
import { resolveActiveThemeId } from './domain/resolve-active-theme';

interface UseThemeMenuResult {
  defaultThemeId: string;
  rows: CampaignThemeRow[];
  coreThemes: CoreThemeOption[];
  setDefaultTheme: (id: string) => void;
  changeRowTheme: (campaignPath: string, themeId: string) => void;
}

const FALLBACK_THEME = 'dark-pathfinder';

export function useThemeMenu(
  rootDir: string,
  campaigns: Campaign[],
  activeCampaign: Campaign,
): UseThemeMenuResult {
  const allThemes = ThemeProvider.listThemes();
  const validThemeIds = allThemes.map((t) => t.id);
  const { core: coreThemes } = buildThemeOptionGroups(allThemes);

  const [defaultThemeId, setDefaultThemeId] = useState<string>(FALLBACK_THEME);
  const [rows, setRows] = useState<CampaignThemeRow[]>(() => buildCampaignThemeRows(campaigns, {}));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      themeSettingsData.getWorkspaceDefaultTheme(rootDir),
      themeSettingsData.getCampaignThemeOverrides(campaigns.map((c) => c.path)),
    ]).then(([defaultTheme, overrides]) => {
      if (cancelled) return;
      setDefaultThemeId(defaultTheme ?? FALLBACK_THEME);
      setRows(buildCampaignThemeRows(campaigns, overrides));
    });
    return () => {
      cancelled = true;
    };
  }, [rootDir]); // eslint-disable-line react-hooks/exhaustive-deps

  function setDefaultTheme(id: string): void {
    void themeSettingsData.setWorkspaceDefaultTheme(rootDir, id);
    setDefaultThemeId(id);
    const activeRow = rows.find((r) => r.campaignPath === activeCampaign.path);
    const campaignOverride = activeRow
      ? activeRow.themeId === USE_DEFAULT
        ? null
        : activeRow.themeId
      : null;
    const active = resolveActiveThemeId({ campaignOverride, workspaceDefault: id, validThemeIds });
    ThemeProvider.setByName(active);
  }

  function changeRowTheme(campaignPath: string, themeId: string): void {
    const persistId = themeId === USE_DEFAULT ? null : themeId;
    void themeSettingsData.setCampaignTheme(campaignPath, persistId);
    const nextRows = rows.map((row) =>
      row.campaignPath === campaignPath ? { ...row, themeId } : row,
    );
    setRows(nextRows);
    if (campaignPath === activeCampaign.path) {
      const active = resolveActiveThemeId({
        campaignOverride: persistId,
        workspaceDefault: defaultThemeId,
        validThemeIds,
      });
      ThemeProvider.setByName(active);
    }
  }

  return {
    defaultThemeId,
    rows,
    coreThemes,
    setDefaultTheme,
    changeRowTheme,
  };
}
