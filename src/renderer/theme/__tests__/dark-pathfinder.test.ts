import { describe, it, expect } from 'vitest';
import { darkPathfinder } from '../dark-pathfinder';

const SKIP_PATHS = new Set(['darkPathfinder.timeline.eventColorPresets']);

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

describe('darkPathfinder', () => {
  it('has no empty string values', () => {
    assertNoEmptyStrings(darkPathfinder, 'darkPathfinder');
  });

  it('has a name', () => {
    expect(darkPathfinder.name).toBe('Darkfinder');
  });

  it('defines all 7 weekday colors', () => {
    const days = darkPathfinder.timeline.days;
    expect(Object.keys(days)).toHaveLength(7);
    for (const color of Object.values(days)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('defines at least one session color', () => {
    expect(darkPathfinder.timeline.sessions.length).toBeGreaterThan(0);
  });

  it('has a "Default (weekday)" preset as the first event color option', () => {
    expect(darkPathfinder.timeline.eventColorPresets[0]).toEqual({
      label: 'Default (weekday)',
      value: '',
    });
  });
});
