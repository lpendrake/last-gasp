import { describe, expect, it } from 'vitest';
import { resolveActiveThemeId } from '../resolve-active-theme';

const VALID_IDS = ['dark-pathfinder', 'lightfinder', 'custom-theme'];

describe('resolveActiveThemeId', () => {
  it('returns the campaign override when it is valid, even if a workspace default is also set', () => {
    expect(
      resolveActiveThemeId({
        campaignOverride: 'lightfinder',
        workspaceDefault: 'custom-theme',
        validThemeIds: VALID_IDS,
      }),
    ).toBe('lightfinder');
  });

  it('falls back to workspace default when override is absent (null)', () => {
    expect(
      resolveActiveThemeId({
        campaignOverride: null,
        workspaceDefault: 'lightfinder',
        validThemeIds: VALID_IDS,
      }),
    ).toBe('lightfinder');
  });

  it('returns dark-pathfinder when both override and default are absent', () => {
    expect(
      resolveActiveThemeId({
        campaignOverride: null,
        workspaceDefault: null,
        validThemeIds: VALID_IDS,
      }),
    ).toBe('dark-pathfinder');
  });

  it('ignores an override that is not in validThemeIds and falls through to the workspace default', () => {
    expect(
      resolveActiveThemeId({
        campaignOverride: 'unknown-theme',
        workspaceDefault: 'lightfinder',
        validThemeIds: VALID_IDS,
      }),
    ).toBe('lightfinder');
  });

  it('returns dark-pathfinder when override is absent and workspace default is an unknown id', () => {
    expect(
      resolveActiveThemeId({
        campaignOverride: null,
        workspaceDefault: 'stale-theme',
        validThemeIds: VALID_IDS,
      }),
    ).toBe('dark-pathfinder');
  });

  it('treats empty-string override as absent and returns the workspace default', () => {
    expect(
      resolveActiveThemeId({
        campaignOverride: '',
        workspaceDefault: 'lightfinder',
        validThemeIds: VALID_IDS,
      }),
    ).toBe('lightfinder');
  });
});
