import { describe, it, expect } from 'vitest';
import { naturalTier, ALL_TIERS, type TimeTier } from './axis.ts';

// Convenience: look up a tier by id
function tier(id: TimeTier['id']): TimeTier {
  const t = ALL_TIERS.find(t => t.id === id);
  if (!t) throw new Error(`No tier: ${id}`);
  return t;
}

describe('naturalTier', () => {
  it('identifies midday (12:00:00 = 43200s)', () => {
    expect(naturalTier(43200, ALL_TIERS)).toBe(tier('midday'));
  });

  it('identifies an hour mark that is not midday (09:00 = 32400s)', () => {
    expect(naturalTier(32400, ALL_TIERS)).toBe(tier('hour'));
  });

  it('identifies 2am (7200s) as an hour, not midday', () => {
    expect(naturalTier(7200, ALL_TIERS)).toBe(tier('hour'));
  });

  it('identifies a half-hour that is not on an hour (00:30 = 1800s)', () => {
    expect(naturalTier(1800, ALL_TIERS)).toBe(tier('half'));
  });

  it('identifies 23:30 (84600s) as half', () => {
    expect(naturalTier(84600, ALL_TIERS)).toBe(tier('half'));
  });

  it('identifies a quarter-hour that is not on a half-hour (00:15 = 900s)', () => {
    expect(naturalTier(900, ALL_TIERS)).toBe(tier('quarter'));
  });

  it('identifies 00:45 (2700s) as quarter', () => {
    expect(naturalTier(2700, ALL_TIERS)).toBe(tier('quarter'));
  });

  it('identifies a minute mark that is not on any coarser boundary (00:01 = 60s)', () => {
    expect(naturalTier(60, ALL_TIERS)).toBe(tier('minute'));
  });

  it('identifies 00:11 (660s) as minute', () => {
    expect(naturalTier(660, ALL_TIERS)).toBe(tier('minute'));
  });

  it('returns null for a second-level value not on any minute boundary (37s)', () => {
    expect(naturalTier(37, ALL_TIERS)).toBeNull();
  });

  it('midday wins over hour when both divide 43200', () => {
    // 43200 is divisible by 3600 (hour step) too, but midday comes first in ALL_TIERS
    expect(naturalTier(43200, ALL_TIERS)?.id).toBe('midday');
  });

  it('half wins over quarter when both divide 1800', () => {
    // 1800 is divisible by 900 (quarter step), but half (1800) appears first
    expect(naturalTier(1800, ALL_TIERS)?.id).toBe('half');
  });

  it('works with a subset of tiers (only midday + hour active)', () => {
    const active = ALL_TIERS.filter(t => t.id === 'midday' || t.id === 'hour');
    expect(naturalTier(43200, active)?.id).toBe('midday');
    expect(naturalTier(3600, active)?.id).toBe('hour');
    // 1800 is not a multiple of either 43200 or 3600 → null
    expect(naturalTier(1800, active)).toBeNull();
  });
});
