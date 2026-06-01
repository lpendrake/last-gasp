import { describe, it, expect } from 'vitest';
import { buildThemeOptionGroups, buildCampaignThemeRows, USE_DEFAULT } from '../theme-options';
import type { ThemeListItem } from '../../../../theme';
import type { Campaign } from '../../../../../types/global';

const coreThemes: ThemeListItem[] = [
  { id: 'dark-pathfinder', name: 'Darkfinder', kind: 'core' },
  { id: 'lightfinder', name: 'Lightfinder', kind: 'core' },
];

const mixedThemes: ThemeListItem[] = [
  ...coreThemes,
  { id: 'my-custom', name: 'My Custom', kind: 'custom' },
];

function makeCampaign(path: string, name?: string): Campaign {
  return {
    id: path,
    name: name ?? path,
    description: '',
    folderName: path,
    path,
  };
}

describe('buildThemeOptionGroups', () => {
  it('splits core themes and always flags custom as coming-soon', () => {
    const groups = buildThemeOptionGroups(mixedThemes);

    expect(groups.core).toHaveLength(2);
    expect(groups.core[0]).toEqual({ id: 'dark-pathfinder', name: 'Darkfinder' });
    expect(groups.core[1]).toEqual({ id: 'lightfinder', name: 'Lightfinder' });
    expect(groups.customComingSoon).toBe(true);
  });

  it('returns an empty core list when no core themes exist', () => {
    const groups = buildThemeOptionGroups([{ id: 'my-custom', name: 'My Custom', kind: 'custom' }]);
    expect(groups.core).toHaveLength(0);
    expect(groups.customComingSoon).toBe(true);
  });
});

describe('buildCampaignThemeRows', () => {
  it('returns one row per campaign in campaigns order', () => {
    const campaigns = [
      makeCampaign('/campaigns/alpha', 'Alpha'),
      makeCampaign('/campaigns/beta', 'Beta'),
    ];
    const overrides: Record<string, string> = {
      '/campaigns/alpha': 'lightfinder',
      '/campaigns/beta': 'dark-pathfinder',
    };

    const rows = buildCampaignThemeRows(campaigns, overrides);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      campaignPath: '/campaigns/alpha',
      campaignName: 'Alpha',
      themeId: 'lightfinder',
    });
    expect(rows[1]).toEqual({
      campaignPath: '/campaigns/beta',
      campaignName: 'Beta',
      themeId: 'dark-pathfinder',
    });
  });

  it('uses USE_DEFAULT for campaigns with no override', () => {
    const campaigns = [
      makeCampaign('/campaigns/alpha', 'Alpha'),
      makeCampaign('/campaigns/beta', 'Beta'),
    ];

    const rows = buildCampaignThemeRows(campaigns, {});

    expect(rows).toHaveLength(2);
    expect(rows[0].themeId).toBe(USE_DEFAULT);
    expect(rows[1].themeId).toBe(USE_DEFAULT);
  });

  it('fills themeId from overrides and falls back to USE_DEFAULT when absent', () => {
    const campaigns = [
      makeCampaign('/campaigns/alpha', 'Alpha'),
      makeCampaign('/campaigns/beta', 'Beta'),
    ];
    const overrides: Record<string, string> = {
      '/campaigns/alpha': 'lightfinder',
    };

    const rows = buildCampaignThemeRows(campaigns, overrides);

    expect(rows[0].themeId).toBe('lightfinder');
    expect(rows[1].themeId).toBe(USE_DEFAULT);
  });

  it('preserves campaigns order regardless of override map key order', () => {
    const campaigns = [
      makeCampaign('/campaigns/zeta', 'Zeta'),
      makeCampaign('/campaigns/alpha', 'Alpha'),
    ];
    const overrides: Record<string, string> = {
      '/campaigns/alpha': 'lightfinder',
      '/campaigns/zeta': 'dark-pathfinder',
    };

    const rows = buildCampaignThemeRows(campaigns, overrides);

    expect(rows[0].campaignPath).toBe('/campaigns/zeta');
    expect(rows[1].campaignPath).toBe('/campaigns/alpha');
  });

  it('returns [] when campaigns list is empty', () => {
    const rows = buildCampaignThemeRows([], { '/campaigns/ghost': 'lightfinder' });
    expect(rows).toHaveLength(0);
  });
});
