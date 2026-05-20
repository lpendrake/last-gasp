// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSavedViewState, saveViewState } from '../view-state-persistence';
import { DEFAULT_SECONDS_PER_PIXEL } from '../../../timeline/math/zoom';

const CAMPAIGN = '/campaigns/test';
const SAMPLE = { centerSeconds: 12345, secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL };

describe('timeline view state persistence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadSavedViewState(CAMPAIGN)).toBeNull();
  });

  it('round-trips a valid view state', () => {
    saveViewState(CAMPAIGN, SAMPLE);
    expect(loadSavedViewState(CAMPAIGN)).toEqual(SAMPLE);
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(`timeline-view:${CAMPAIGN}`, 'not-json');
    expect(loadSavedViewState(CAMPAIGN)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    localStorage.setItem(`timeline-view:${CAMPAIGN}`, JSON.stringify({ centerSeconds: 1 }));
    expect(loadSavedViewState(CAMPAIGN)).toBeNull();
  });

  it('returns null when field types are wrong', () => {
    localStorage.setItem(
      `timeline-view:${CAMPAIGN}`,
      JSON.stringify({ centerSeconds: 'abc', secondsPerPixel: 432 }),
    );
    expect(loadSavedViewState(CAMPAIGN)).toBeNull();
  });

  it('isolates state by campaign path', () => {
    const other = { centerSeconds: 99999, secondsPerPixel: 1 };
    saveViewState(CAMPAIGN, SAMPLE);
    saveViewState('/campaigns/other', other);
    expect(loadSavedViewState(CAMPAIGN)).toEqual(SAMPLE);
    expect(loadSavedViewState('/campaigns/other')).toEqual(other);
  });

  it('overwrites previous state on repeated save', () => {
    saveViewState(CAMPAIGN, SAMPLE);
    const updated = { centerSeconds: 999, secondsPerPixel: 2 };
    saveViewState(CAMPAIGN, updated);
    expect(loadSavedViewState(CAMPAIGN)).toEqual(updated);
  });

  it('survives a failing localStorage.getItem gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(() => loadSavedViewState(CAMPAIGN)).not.toThrow();
    expect(loadSavedViewState(CAMPAIGN)).toBeNull();
    vi.restoreAllMocks();
  });

  it('survives a failing localStorage.setItem gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(() => saveViewState(CAMPAIGN, SAMPLE)).not.toThrow();
    vi.restoreAllMocks();
  });
});
