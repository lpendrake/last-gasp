import { describe, it, expect } from 'vitest';
import { lightfinder } from '../lightfinder';

const SKIP_PATHS = new Set(['lightfinder.timeline.eventColorPresets']);

function assertNoEmptyStrings(obj: unknown, path: string): void {
  if (SKIP_PATHS.has(path)) return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoEmptyStrings(item, `${path}[${i}]`));
    return;
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      assertNoEmptyStrings(value, `${path}.${key}`);
    }
    return;
  }
  if (typeof obj === 'string') {
    expect(obj, `${path} must not be empty`).not.toBe('');
  }
}

describe('lightfinder', () => {
  it('has no empty string values (skipping eventColorPresets)', () => {
    assertNoEmptyStrings(lightfinder, 'lightfinder');
  });

  it('has name === "Lightfinder"', () => {
    expect(lightfinder.name).toBe('Lightfinder');
  });

  it('defines all 7 weekday colors as valid 6-digit hex values', () => {
    const days = lightfinder.timeline.days;
    expect(Object.keys(days)).toHaveLength(7);
    for (const color of Object.values(days)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('has "Default (weekday)" as the first event color preset sentinel', () => {
    expect(lightfinder.timeline.eventColorPresets[0]).toEqual({
      label: 'Default (weekday)',
      value: '',
    });
  });
});
