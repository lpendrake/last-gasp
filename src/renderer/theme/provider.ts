import { darkPathfinder } from './dark-pathfinder';
import type { Theme, DeepPartial } from './types';

let activeTheme: Theme = darkPathfinder;

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function applyCssVars(theme: Theme): void {
  const root = document.documentElement.style;

  const chromeMap: Record<string, string> = {
    background: theme.chrome.background,
    surface: theme.chrome.surface,
    panel: theme.chrome.panel,
    'panel-accent': theme.chrome.panelAccent,
    'text-primary': theme.chrome.textPrimary,
    'text-secondary': theme.chrome.textSecondary,
    'text-muted': theme.chrome.textMuted,
    'accent-gold': theme.chrome.accentGold,
    'accent-warm': theme.chrome.accentWarm,
    accent: theme.chrome.accent,
    link: theme.chrome.link,
    border: theme.chrome.border,
    'border-strong': theme.chrome.borderStrong,
    danger: theme.chrome.danger,
    'danger-hover': theme.chrome.dangerHover,
    'dotted-future': theme.chrome.dottedFuture,
  };

  for (const [key, value] of Object.entries(chromeMap)) {
    root.setProperty(`--theme-${key}`, value);
  }

  const rgbKeys = ['accent-gold', 'accent-warm', 'danger'] as const;
  const rgbSources: Record<(typeof rgbKeys)[number], string> = {
    'accent-gold': theme.chrome.accentGold,
    'accent-warm': theme.chrome.accentWarm,
    danger: theme.chrome.danger,
  };
  for (const key of rgbKeys) {
    root.setProperty(`--theme-${key}-rgb`, hexToRgb(rgbSources[key]));
  }

  for (const [key, value] of Object.entries(theme.notes.kinds)) {
    root.setProperty(`--kind-${key}`, value);
  }

  root.setProperty('--notes-saved', theme.notes.savedIndicator);
  root.setProperty('--notes-error', theme.notes.errorToast);
}

function deepMerge(base: Theme, overrides: DeepPartial<Theme>): Theme {
  const result = { ...base };
  for (const key of Object.keys(overrides) as (keyof Theme)[]) {
    const baseVal = base[key];
    const overVal = overrides[key];
    if (overVal === undefined) continue;
    if (
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal) &&
      typeof overVal === 'object' &&
      overVal !== null &&
      !Array.isArray(overVal)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        baseVal as unknown as Theme,
        overVal as DeepPartial<Theme>,
      ) as unknown;
    } else {
      (result as Record<string, unknown>)[key] = overVal;
    }
  }
  return result;
}

export const ThemeProvider = {
  init(): void {
    applyCssVars(activeTheme);
  },

  get(): Theme {
    return activeTheme;
  },

  set(custom: DeepPartial<Theme>): void {
    activeTheme = deepMerge(darkPathfinder, custom);
    applyCssVars(activeTheme);
  },
};
