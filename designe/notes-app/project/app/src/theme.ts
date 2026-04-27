import type { Palette } from './data/types.ts';
import { getPalette } from './data/api.ts';
import { weekdayIndex, parseISOString } from './calendar/golarian.ts';

let currentPalette: Palette | null = null;

const WEEKDAY_KEYS: (keyof Palette['weekdays'])[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export async function loadPalette(): Promise<Palette> {
  currentPalette = await getPalette();
  applyCssVariables(currentPalette);
  return currentPalette;
}

export function getPaletteSync(): Palette {
  if (!currentPalette) throw new Error('Palette not loaded — call loadPalette() first');
  return currentPalette;
}

export function themeColor(key: keyof Palette['theme']): string {
  return getPaletteSync().theme[key];
}

/** Return the weekday colour for a given ISO Golarian date string. */
export function weekdayColor(isoString: string): string {
  const date = parseISOString(isoString);
  const idx = weekdayIndex(date);
  return getPaletteSync().weekdays[WEEKDAY_KEYS[idx]];
}

function applyCssVariables(palette: Palette) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(palette.theme)) {
    root.setProperty(`--theme-${k.replace(/_/g, '-')}`, v);
  }
  for (const [k, v] of Object.entries(palette.weekdays)) {
    root.setProperty(`--weekday-${k}`, v);
  }
}
