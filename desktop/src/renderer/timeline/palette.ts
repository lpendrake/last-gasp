import type { CSSProperties } from 'react';
import type { Palette } from './data/types';

/**
 * Convert a Palette to a React CSSProperties object of scoped CSS variables.
 * Palette keys use underscores (e.g. `border_strong`); CSS vars use dashes
 * (e.g. `--theme-border-strong`), matching the transformation in the web app's
 * applyCssVariables.
 */
export function paletteToCssVars(palette: Palette): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(palette.theme)) {
    vars[`--theme-${key.replace(/_/g, '-')}`] = value;
  }
  return vars as CSSProperties;
}
