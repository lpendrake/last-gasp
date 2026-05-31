import type { Campaign } from '../../../../types/global';
import type { ThemeListItem } from '../../../theme';

export interface CoreThemeOption {
  id: string;
  name: string;
}

export interface ThemeOptionGroups {
  core: CoreThemeOption[];
  customComingSoon: true;
}

export interface OverrideRow {
  campaignPath: string;
  themeId: string;
}

export function buildThemeOptionGroups(themes: ThemeListItem[]): ThemeOptionGroups {
  const core = themes.filter((t) => t.kind === 'core').map(({ id, name }) => ({ id, name }));

  return { core, customComingSoon: true };
}

export function buildInitialOverrideRows(
  campaigns: Campaign[],
  overrides: Record<string, string>,
): OverrideRow[] {
  const campaignPathSet = new Set(campaigns.map((c) => c.path));

  return Object.entries(overrides)
    .filter(([path]) => campaignPathSet.has(path))
    .map(([campaignPath, themeId]) => ({ campaignPath, themeId }));
}
