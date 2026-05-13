import { describe, it, expect } from 'vitest';
import { generateShortId } from '../ids';

describe('generateShortId', () => {
  it('should return a string of length 4', () => {
    const id = generateShortId();
    expect(id).toHaveLength(4);
    expect(typeof id).toBe('string');
  });

  it('should only contain alphanumeric characters', () => {
    const regex = /^[a-z0-9]{4}$/;
    for (let i = 0; i < 100; i++) {
      expect(generateShortId()).toMatch(regex);
    }
  });

  it('should be reasonably unique (low collision in small samples)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateShortId());
    }
    // With 1.68M possible IDs, the birthday problem gives ~0.03% chance of
    // any collision in 1000 samples.  Allow up to 2 collisions so the test
    // is non-flaky while still failing if the generator is badly broken.
    expect(ids.size).toBeGreaterThanOrEqual(998);
  });
});
