// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { loadPreviewSize, usePreviewSize } from '../usePreviewSize';

const KEY = 'preview-card-size';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
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

describe('usePreviewSize — save path', () => {
  it('save updates the returned state', () => {
    const { result } = renderHook(() => usePreviewSize());
    expect(result.current[0]).toEqual({ width: 640, expandedHeight: 480 });

    act(() => {
      result.current[1]({ width: 900, expandedHeight: 350 });
    });

    expect(result.current[0]).toEqual({ width: 900, expandedHeight: 350 });
  });

  it('save writes to localStorage so loadPreviewSize returns the new value', () => {
    const { result } = renderHook(() => usePreviewSize());

    act(() => {
      result.current[1]({ width: 720, expandedHeight: 400 });
    });

    expect(loadPreviewSize()).toEqual({ width: 720, expandedHeight: 400 });
  });

  it('save still updates in-memory state when setItem throws (e.g. quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => usePreviewSize());

    act(() => {
      result.current[1]({ width: 500, expandedHeight: 200 });
    });

    // State updated despite the write failure
    expect(result.current[0]).toEqual({ width: 500, expandedHeight: 200 });
  });
});
