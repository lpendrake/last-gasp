import { useEffect, useState } from 'react';
import type { Campaign } from '../../../types/global';
import { ThemeProvider } from '../../theme';
import { themeSettingsData } from './theme-settings-data';
import {
  buildInitialOverrideRows,
  buildThemeOptionGroups,
  type CoreThemeOption,
  type OverrideRow,
} from './domain/theme-options';
import { resolveActiveThemeId } from './domain/resolve-active-theme';

interface UseThemeMenuResult {
  defaultThemeId: string;
  overrideRows: OverrideRow[];
  coreThemes: CoreThemeOption[];
  setDefaultTheme: (id: string) => void;
  addOverrideRow: () => void;
  changeRowCampaign: (index: number, path: string) => void;
  changeRowTheme: (index: number, id: string) => void;
  removeRow: (index: number) => void;
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
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      themeSettingsData.getWorkspaceDefaultTheme(rootDir),
      themeSettingsData.getCampaignThemeOverrides(campaigns.map((c) => c.path)),
    ]).then(([defaultTheme, overrides]) => {
      if (cancelled) return;
      setDefaultThemeId(defaultTheme ?? FALLBACK_THEME);
      setOverrideRows(buildInitialOverrideRows(campaigns, overrides));
    });
    return () => {
      cancelled = true;
    };
  }, [rootDir]); // eslint-disable-line react-hooks/exhaustive-deps

  function getCurrentOverrideForCampaign(rows: OverrideRow[], campaignPath: string): string | null {
    const row = rows.find((r) => r.campaignPath === campaignPath);
    return row ? row.themeId : null;
  }

  function setDefaultTheme(id: string): void {
    void themeSettingsData.setWorkspaceDefaultTheme(rootDir, id);
    setDefaultThemeId(id);
    const campaignOverride = getCurrentOverrideForCampaign(overrideRows, activeCampaign.path);
    const active = resolveActiveThemeId({ campaignOverride, workspaceDefault: id, validThemeIds });
    ThemeProvider.setByName(active);
  }

  function addOverrideRow(): void {
    setOverrideRows((prev) => [
      { campaignPath: activeCampaign.path, themeId: defaultThemeId },
      ...prev,
    ]);
  }

  function changeRowCampaign(index: number, path: string): void {
    setOverrideRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, campaignPath: path } : row));
      const row = next[index];
      void themeSettingsData.setCampaignTheme(path, row.themeId);
      if (path === activeCampaign.path) {
        const active = resolveActiveThemeId({
          campaignOverride: row.themeId,
          workspaceDefault: defaultThemeId,
          validThemeIds,
        });
        ThemeProvider.setByName(active);
      }
      return next;
    });
  }

  function changeRowTheme(index: number, id: string): void {
    setOverrideRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, themeId: id } : row));
      const row = next[index];
      void themeSettingsData.setCampaignTheme(row.campaignPath, id);
      if (row.campaignPath === activeCampaign.path) {
        const active = resolveActiveThemeId({
          campaignOverride: id,
          workspaceDefault: defaultThemeId,
          validThemeIds,
        });
        ThemeProvider.setByName(active);
      }
      return next;
    });
  }

  function removeRow(index: number): void {
    setOverrideRows((prev) => {
      const row = prev[index];
      if (row) {
        void themeSettingsData.setCampaignTheme(row.campaignPath, null);
        if (row.campaignPath === activeCampaign.path) {
          const active = resolveActiveThemeId({
            campaignOverride: null,
            workspaceDefault: defaultThemeId,
            validThemeIds,
          });
          ThemeProvider.setByName(active);
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  return {
    defaultThemeId,
    overrideRows,
    coreThemes,
    setDefaultTheme,
    addOverrideRow,
    changeRowCampaign,
    changeRowTheme,
    removeRow,
  };
}
