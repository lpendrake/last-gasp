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

/** Sentinel value meaning "no override — use the workspace default". */
export const USE_DEFAULT = '';

export interface CampaignThemeRow {
  campaignPath: string;
  campaignName: string;
  /** Override theme id, or USE_DEFAULT ('') if no override is set. */
  themeId: string;
}

export function buildThemeOptionGroups(themes: ThemeListItem[]): ThemeOptionGroups {
  const core = themes.filter((t) => t.kind === 'core').map(({ id, name }) => ({ id, name }));

  return { core, customComingSoon: true };
}

/**
 * Builds one row per campaign, in campaigns order.
 * themeId is the persisted override id, or USE_DEFAULT ('') if no override exists.
 */
export function buildCampaignThemeRows(
  campaigns: Campaign[],
  overrides: Record<string, string>,
): CampaignThemeRow[] {
  return campaigns.map((c) => ({
    campaignPath: c.path,
    campaignName: c.name,
    themeId: overrides[c.path] ?? USE_DEFAULT,
  }));
}
