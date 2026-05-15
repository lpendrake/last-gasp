// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SECONDS_PER_PIXEL } from '../../../timeline/math/zoom';

// We test the persistence helpers extracted from timeline-view by reimplementing
// them here so the test does not need to mount a React component.

type ViewState = { centerSeconds: number; secondsPerPixel: number };

function key(campaignPath: string) {
  return `timeline-view:${campaignPath}`;
}

function loadSaved(campaignPath: string): ViewState | null {
  try {
    const raw = localStorage.getItem(key(campaignPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'centerSeconds' in parsed &&
      'secondsPerPixel' in parsed &&
      typeof (parsed as ViewState).centerSeconds === 'number' &&
      typeof (parsed as ViewState).secondsPerPixel === 'number'
    ) {
      return parsed as ViewState;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function save(campaignPath: string, view: ViewState): void {
  localStorage.setItem(key(campaignPath), JSON.stringify(view));
}

const CAMPAIGN = '/campaigns/test';
const SAMPLE: ViewState = { centerSeconds: 12345, secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL };

describe('timeline view state persistence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadSaved(CAMPAIGN)).toBeNull();
  });

  it('round-trips a valid view state', () => {
    save(CAMPAIGN, SAMPLE);
    expect(loadSaved(CAMPAIGN)).toEqual(SAMPLE);
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(key(CAMPAIGN), 'not-json');
    expect(loadSaved(CAMPAIGN)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    localStorage.setItem(key(CAMPAIGN), JSON.stringify({ centerSeconds: 1 }));
    expect(loadSaved(CAMPAIGN)).toBeNull();
  });

  it('returns null when field types are wrong', () => {
    localStorage.setItem(
      key(CAMPAIGN),
      JSON.stringify({ centerSeconds: 'abc', secondsPerPixel: 432 }),
    );
    expect(loadSaved(CAMPAIGN)).toBeNull();
  });

  it('isolates state by campaign path', () => {
    const other: ViewState = { centerSeconds: 99999, secondsPerPixel: 1 };
    save(CAMPAIGN, SAMPLE);
    save('/campaigns/other', other);
    expect(loadSaved(CAMPAIGN)).toEqual(SAMPLE);
    expect(loadSaved('/campaigns/other')).toEqual(other);
  });

  it('overwrites previous state on repeated save', () => {
    save(CAMPAIGN, SAMPLE);
    const updated: ViewState = { centerSeconds: 999, secondsPerPixel: 2 };
    save(CAMPAIGN, updated);
    expect(loadSaved(CAMPAIGN)).toEqual(updated);
  });

  it('survives a failing localStorage gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(() => loadSaved(CAMPAIGN)).not.toThrow();
    expect(loadSaved(CAMPAIGN)).toBeNull();
    vi.restoreAllMocks();
  });
});
