// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPreviewSize } from '../usePreviewSize';

const KEY = 'preview-card-size';

beforeEach(() => {
  localStorage.clear();
});

describe('loadPreviewSize', () => {
  it('returns defaults when localStorage is empty', () => {
    const { width, expandedHeight } = loadPreviewSize();
    expect(width).toBe(640);
    expect(expandedHeight).toBe(480);
  });

  it('returns stored values when they are valid numbers', () => {
    localStorage.setItem(KEY, JSON.stringify({ width: 800, expandedHeight: 300 }));
    const { width, expandedHeight } = loadPreviewSize();
    expect(width).toBe(800);
    expect(expandedHeight).toBe(300);
  });

  it('returns defaults when the stored value is corrupt JSON', () => {
    localStorage.setItem(KEY, 'not-json');
    const { width, expandedHeight } = loadPreviewSize();
    expect(width).toBe(640);
    expect(expandedHeight).toBe(480);
  });

  it('returns defaults when the stored object is missing fields', () => {
    localStorage.setItem(KEY, JSON.stringify({ width: 800 }));
    const { width, expandedHeight } = loadPreviewSize();
    expect(width).toBe(640);
    expect(expandedHeight).toBe(480);
  });

  it('returns defaults when stored fields are non-numeric', () => {
    localStorage.setItem(KEY, JSON.stringify({ width: '800', expandedHeight: 300 }));
    const { width, expandedHeight } = loadPreviewSize();
    expect(width).toBe(640);
    expect(expandedHeight).toBe(480);
  });

  it('round-trips values through JSON.stringify correctly', () => {
    const stored = { width: 512, expandedHeight: 256 };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(loadPreviewSize()).toEqual(stored);
  });
});
