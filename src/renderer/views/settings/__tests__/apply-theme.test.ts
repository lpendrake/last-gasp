// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '../../../theme';
import { applyWorkspaceDefaultTheme, applyCampaignTheme } from '../apply-theme';

// Minimal fsApi stub — we override getWorkspaceDefaultTheme / getCampaignTheme per test.
const fsApiStub = {
  getWorkspaceDefaultTheme: vi.fn<() => Promise<string | null>>(),
  setWorkspaceDefaultTheme: vi.fn(),
  getCampaignTheme: vi.fn<() => Promise<string | null>>(),
  setCampaignTheme: vi.fn(),
  getCampaignThemeOverrides: vi.fn(),
};

vi.stubGlobal('window', {
  ...globalThis.window,
  fsApi: fsApiStub,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to known state before each test.
  ThemeProvider.setByName('dark-pathfinder');
});

describe('applyWorkspaceDefaultTheme', () => {
  it('applies the saved workspace default theme', async () => {
    fsApiStub.getWorkspaceDefaultTheme.mockResolvedValue('lightfinder');

    await applyWorkspaceDefaultTheme('/workspace');

    expect(ThemeProvider.getActiveThemeId()).toBe('lightfinder');
  });

  it('falls back to dark-pathfinder when no default is saved', async () => {
    fsApiStub.getWorkspaceDefaultTheme.mockResolvedValue(null);

    await applyWorkspaceDefaultTheme('/workspace');

    expect(ThemeProvider.getActiveThemeId()).toBe('dark-pathfinder');
  });
});

describe('applyCampaignTheme', () => {
  it('applies the campaign override when present', async () => {
    fsApiStub.getWorkspaceDefaultTheme.mockResolvedValue('dark-pathfinder');
    fsApiStub.getCampaignTheme.mockResolvedValue('lightfinder');

    await applyCampaignTheme('/workspace', '/workspace/my-campaign');

    expect(ThemeProvider.getActiveThemeId()).toBe('lightfinder');
  });

  it('applies the workspace default when the campaign has no override', async () => {
    fsApiStub.getWorkspaceDefaultTheme.mockResolvedValue('lightfinder');
    fsApiStub.getCampaignTheme.mockResolvedValue(null);

    await applyCampaignTheme('/workspace', '/workspace/my-campaign');

    expect(ThemeProvider.getActiveThemeId()).toBe('lightfinder');
  });

  it('falls back to dark-pathfinder when neither workspace default nor campaign override is set', async () => {
    fsApiStub.getWorkspaceDefaultTheme.mockResolvedValue(null);
    fsApiStub.getCampaignTheme.mockResolvedValue(null);

    await applyCampaignTheme('/workspace', '/workspace/my-campaign');

    expect(ThemeProvider.getActiveThemeId()).toBe('dark-pathfinder');
  });
});
