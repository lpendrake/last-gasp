// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '../provider';
import { lightfinder } from '../lightfinder';

beforeEach(() => {
  // Reset to dark-pathfinder before each test to avoid cross-test leakage.
  ThemeProvider.setByName('dark-pathfinder');
});

describe('ThemeProvider — listThemes', () => {
  it('includes both dark-pathfinder and lightfinder, both with kind "core"', () => {
    const themes = ThemeProvider.listThemes();
    const ids = themes.map((t) => t.id);
    expect(ids).toContain('dark-pathfinder');
    expect(ids).toContain('lightfinder');
    for (const item of themes) {
      expect(item.kind).toBe('core');
    }
  });
});

describe('ThemeProvider — setByName', () => {
  it('switches to lightfinder: get() returns the lightfinder object and getActiveThemeId() === "lightfinder"', () => {
    ThemeProvider.setByName('lightfinder');
    expect(ThemeProvider.get()).toBe(lightfinder);
    expect(ThemeProvider.getActiveThemeId()).toBe('lightfinder');
  });

  it('falls back to dark-pathfinder for an unknown id', () => {
    ThemeProvider.setByName('nope');
    expect(ThemeProvider.getActiveThemeId()).toBe('dark-pathfinder');
  });
});

describe('ThemeProvider — subscribe', () => {
  it('calls the listener when setByName is invoked, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = ThemeProvider.subscribe(listener);

    ThemeProvider.setByName('lightfinder');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    ThemeProvider.setByName('dark-pathfinder');
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });
});

describe('ThemeProvider — CSS vars', () => {
  it('sets --theme-background to lightfinder.chrome.background after setByName("lightfinder")', () => {
    ThemeProvider.setByName('lightfinder');
    const value = document.documentElement.style.getPropertyValue('--theme-background');
    expect(value).toBe(lightfinder.chrome.background);
  });
});
