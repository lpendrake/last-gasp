import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadDraft, writeDraft, clearDraft, draftIsRelevant,
  debounce, parseTagsText, bufferFromEvent, bufferToFrontmatter,
  type DraftBuffer, type DraftRecord,
} from './drafts.ts';

// Minimal in-memory localStorage polyfill for Node/vitest.
class MemStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return [...this.store.keys()][i] ?? null; }
  get length() { return this.store.size; }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemStorage();
});

const BUF: DraftBuffer = {
  title: 'chess puzzle',
  date: '4726-05-04T09:30',
  tagsText: 'plot:beast, location:fort',
  color: '',
  status: '',
  body: 'Players faced the rook knight.',
};

describe('parseTagsText', () => {
  it('splits on commas and newlines, trims, dedupes', () => {
    expect(parseTagsText('a, b,c\n a , d\nb')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('drops empty segments', () => {
    expect(parseTagsText(', , a , ,\n')).toEqual(['a']);
  });
  it('returns empty for empty input', () => {
    expect(parseTagsText('')).toEqual([]);
    expect(parseTagsText('   \n, ,')).toEqual([]);
  });
});

describe('bufferFromEvent', () => {
  it('flattens tags array to comma-separated string', () => {
    const b = bufferFromEvent({
      title: 't', date: 'd', tags: ['a', 'b'], body: 'body',
    });
    expect(b.tagsText).toBe('a, b');
    expect(b.color).toBe('');
    expect(b.status).toBe('');
  });
  it('handles missing optional fields', () => {
    const b = bufferFromEvent({ title: 't', date: 'd', body: '' });
    expect(b.tagsText).toBe('');
    expect(b.color).toBe('');
    expect(b.status).toBe('');
  });
  it('carries color + status through', () => {
    const b = bufferFromEvent({
      title: 't', date: 'd', tags: [], color: '#c43', status: 'planned', body: '',
    });
    expect(b.color).toBe('#c43');
    expect(b.status).toBe('planned');
  });
});

describe('bufferToFrontmatter', () => {
  it('includes only non-empty optional fields', () => {
    const fm = bufferToFrontmatter({
      title: 'T', date: 'D', tagsText: '', color: '', status: '', body: 'x',
    });
    expect(fm).toEqual({ title: 'T', date: 'D' });
  });
  it('trims title, date, color', () => {
    const fm = bufferToFrontmatter({
      title: '  T  ', date: ' D ', tagsText: '', color: ' #abc ', status: '', body: '',
    });
    expect(fm.title).toBe('T');
    expect(fm.date).toBe('D');
    expect(fm.color).toBe('#abc');
  });
  it('parses and dedupes tags', () => {
    const fm = bufferToFrontmatter({
      title: 'T', date: 'D', tagsText: 'a, b,\n a, c', color: '', status: 'happened', body: '',
    });
    expect(fm.tags).toEqual(['a', 'b', 'c']);
    expect(fm.status).toBe('happened');
  });
});

describe('localStorage round-trip', () => {
  it('writes and reads an existing-file draft', () => {
    const k = { kind: 'existing' as const, filename: '4726-05-04-chess.md' };
    writeDraft(k, BUF, 'Wed, 22 Apr 2026 10:00:00 GMT');
    const rec = loadDraft(k);
    expect(rec).not.toBeNull();
    expect(rec!.buffer).toEqual(BUF);
    expect(rec!.baseMtime).toBe('Wed, 22 Apr 2026 10:00:00 GMT');
    expect(rec!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('writes and reads a new-event draft', () => {
    const k = { kind: 'new' as const, stamp: '2026-04-22T10-00-00Z' };
    writeDraft(k, BUF, null);
    const rec = loadDraft(k);
    expect(rec).not.toBeNull();
    expect(rec!.baseMtime).toBeNull();
  });
  it('clearDraft removes the entry', () => {
    const k = { kind: 'existing' as const, filename: 'x.md' };
    writeDraft(k, BUF, null);
    expect(loadDraft(k)).not.toBeNull();
    clearDraft(k);
    expect(loadDraft(k)).toBeNull();
  });
  it('returns null for unknown key', () => {
    expect(loadDraft({ kind: 'existing', filename: 'missing.md' })).toBeNull();
  });
  it('returns null for corrupt JSON', () => {
    (globalThis as any).localStorage.setItem('draft:x.md', '{not json');
    expect(loadDraft({ kind: 'existing', filename: 'x.md' })).toBeNull();
  });
  it('uses distinct keys for existing vs new', () => {
    const a = { kind: 'existing' as const, filename: 'x.md' };
    const b = { kind: 'new' as const, stamp: 'x.md' };
    writeDraft(a, { ...BUF, title: 'A' }, null);
    writeDraft(b, { ...BUF, title: 'B' }, null);
    expect(loadDraft(a)!.buffer.title).toBe('A');
    expect(loadDraft(b)!.buffer.title).toBe('B');
  });
});

describe('draftIsRelevant', () => {
  const now = '2026-04-22T10:00:00.000Z';
  const earlier = '2026-04-22T09:00:00.000Z';
  const later = '2026-04-22T11:00:00.000Z';
  const draft = (savedAt: string): DraftRecord => ({ buffer: BUF, savedAt, baseMtime: null });

  it('is relevant when newer than the file mtime', () => {
    expect(draftIsRelevant(draft(later), now)).toBe(true);
  });
  it('is NOT relevant when older than the file mtime', () => {
    expect(draftIsRelevant(draft(earlier), now)).toBe(false);
  });
  it('is relevant when no baseMtime is known', () => {
    expect(draftIsRelevant(draft(earlier), null)).toBe(true);
  });
  it('is relevant when saved-at times are unparseable', () => {
    expect(draftIsRelevant(draft('nonsense'), now)).toBe(true);
  });
});

describe('debounce', () => {
  it('calls only the trailing invocation within the window', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });
  it('resets the timer on each call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1);
    vi.advanceTimersByTime(80);
    debounced(2);
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });
});
