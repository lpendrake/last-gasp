import { describe, it, expect } from 'vitest';
import { buildThemeOptionGroups, buildInitialOverrideRows } from '../theme-options';
import type { ThemeListItem } from '../../../../theme';
import type { Campaign } from '../../../../../types/global';

const coreThemes: ThemeListItem[] = [
  { id: 'dark-pathfinder', name: 'Dark Pathfinder', kind: 'core' },
  { id: 'lightfinder', name: 'Lightfinder', kind: 'core' },
];

const mixedThemes: ThemeListItem[] = [
  ...coreThemes,
  { id: 'my-custom', name: 'My Custom', kind: 'custom' },
];

function makeCampaign(path: string): Campaign {
  return {
    id: path,
    name: path,
    description: '',
    folderName: path,
    path,
  };
}

describe('buildThemeOptionGroups', () => {
  it('splits core themes and always flags custom as coming-soon', () => {
    const groups = buildThemeOptionGroups(mixedThemes);

    expect(groups.core).toHaveLength(2);
    expect(groups.core[0]).toEqual({ id: 'dark-pathfinder', name: 'Dark Pathfinder' });
    expect(groups.core[1]).toEqual({ id: 'lightfinder', name: 'Lightfinder' });
    expect(groups.customComingSoon).toBe(true);
  });

  it('returns an empty core list when no core themes exist', () => {
    const groups = buildThemeOptionGroups([{ id: 'my-custom', name: 'My Custom', kind: 'custom' }]);
    expect(groups.core).toHaveLength(0);
    expect(groups.customComingSoon).toBe(true);
  });
});

describe('buildInitialOverrideRows', () => {
  it('returns one row per campaign present in the overrides map with its themeId', () => {
    const campaigns = [makeCampaign('/campaigns/alpha'), makeCampaign('/campaigns/beta')];
    const overrides: Record<string, string> = {
      '/campaigns/alpha': 'lightfinder',
      '/campaigns/beta': 'dark-pathfinder',
    };

    const rows = buildInitialOverrideRows(campaigns, overrides);

    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ campaignPath: '/campaigns/alpha', themeId: 'lightfinder' });
    expect(rows).toContainEqual({ campaignPath: '/campaigns/beta', themeId: 'dark-pathfinder' });
  });

  it('returns [] when no overrides are provided', () => {
    const campaigns = [makeCampaign('/campaigns/alpha')];
    const rows = buildInitialOverrideRows(campaigns, {});
    expect(rows).toHaveLength(0);
  });

  it('ignores override entries whose path is not in the campaigns list', () => {
    const campaigns = [makeCampaign('/campaigns/alpha')];
    const overrides: Record<string, string> = {
      '/campaigns/alpha': 'lightfinder',
      '/campaigns/ghost': 'dark-pathfinder',
    };

    const rows = buildInitialOverrideRows(campaigns, overrides);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ campaignPath: '/campaigns/alpha', themeId: 'lightfinder' });
  });
});
