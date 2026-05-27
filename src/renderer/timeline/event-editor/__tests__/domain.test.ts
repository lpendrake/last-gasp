import { describe, it, expect } from 'vitest';
import {
  emptyBuffer,
  bufferFromEvent,
  bufferToFrontmatter,
  validateBuffer,
  deriveFilename,
  getColorPresetValue,
  parseTagsText,
  buildTagChips,
  type EditorBuffer,
} from '../domain';
import { ThemeProvider } from '../../../theme';
import type { Event } from '../../data/types';

// ---- helpers ----

function buf(overrides: Partial<EditorBuffer> = {}): EditorBuffer {
  return {
    title: 'Test Event',
    date: '4726-05-04',
    tagsText: '',
    color: '',
    body: '',
    ...overrides,
  };
}

function event(overrides: Partial<Event> = {}): Event {
  return {
    filename: '4726-05-04-test.md',
    title: 'Test Event',
    date: '4726-05-04',
    tags: [],
    body: '',
    mtime: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---- emptyBuffer ----

describe('emptyBuffer', () => {
  it('returns all empty strings when no initialDate', () => {
    const b = emptyBuffer();
    expect(b).toEqual({ title: '', date: '', tagsText: '', color: '', body: '' });
  });

  it('places initialDate in the date field', () => {
    const b = emptyBuffer('4726-03-01');
    expect(b.date).toBe('4726-03-01');
    expect(b.title).toBe('');
  });
});

// ---- parseTagsText ----

describe('parseTagsText', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(parseTagsText('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty string', () => {
    expect(parseTagsText('')).toEqual([]);
  });

  it('ignores whitespace-only entries', () => {
    expect(parseTagsText('a, , b')).toEqual(['a', 'b']);
  });

  it('handles trailing comma', () => {
    expect(parseTagsText('a, b,')).toEqual(['a', 'b']);
  });

  it('handles single tag without comma', () => {
    expect(parseTagsText('combat')).toEqual(['combat']);
  });
});

// ---- bufferFromEvent ----

describe('bufferFromEvent', () => {
  it('maps event fields to buffer', () => {
    const ev = event({
      title: 'Big Battle',
      date: '4726-05-04T09:30',
      tags: ['combat', 'plot'],
      color: '#a83030',
      body: '# Notes\nHello',
    });
    const b = bufferFromEvent(ev);
    expect(b.title).toBe('Big Battle');
    expect(b.date).toBe('4726-05-04T09:30');
    expect(b.tagsText).toBe('combat, plot');
    expect(b.color).toBe('#a83030');
    expect(b.body).toBe('# Notes\nHello');
  });

  it('produces empty tagsText when event has no tags', () => {
    expect(bufferFromEvent(event({ tags: [] })).tagsText).toBe('');
  });

  it('handles missing tags array gracefully', () => {
    const ev = event();
    (ev as unknown as { tags?: string[] }).tags = undefined;
    expect(bufferFromEvent(ev).tagsText).toBe('');
  });

  it('maps missing color to empty string', () => {
    const ev = event();
    delete (ev as Partial<Event>).color;
    expect(bufferFromEvent(ev).color).toBe('');
  });

  it('excludes entity tags from tagsText', () => {
    const ev = event({ tags: ['combat', 'id:ab12', 'plot'] });
    expect(bufferFromEvent(ev).tagsText).toBe('combat, plot');
  });

  it('produces empty tagsText when all tags are entity tags', () => {
    const ev = event({ tags: ['id:ab12', 'id:cd34'] });
    expect(bufferFromEvent(ev).tagsText).toBe('');
  });
});

// ---- bufferToFrontmatter ----

describe('bufferToFrontmatter', () => {
  it('splits tagsText by comma and trims whitespace', () => {
    const fm = bufferToFrontmatter(buf({ tagsText: 'a, b,  c' }));
    expect(fm.tags).toEqual(['a', 'b', 'c']);
  });

  it('omits tags field when tagsText is empty', () => {
    const fm = bufferToFrontmatter(buf({ tagsText: '' }));
    expect('tags' in fm).toBe(false);
  });

  it('omits color field when color is empty', () => {
    const fm = bufferToFrontmatter(buf({ color: '' }));
    expect('color' in fm).toBe(false);
  });

  it('includes color when set', () => {
    const fm = bufferToFrontmatter(buf({ color: '#a83030' }));
    expect(fm.color).toBe('#a83030');
  });

  it('trims title and date', () => {
    const fm = bufferToFrontmatter(buf({ title: '  My Event  ', date: '  4726-05-04  ' }));
    expect(fm.title).toBe('My Event');
    expect(fm.date).toBe('4726-05-04');
  });

  it('syncs entity tags from wiki links in the body', () => {
    const fm = bufferToFrontmatter(
      buf({ tagsText: 'combat', body: 'Met [[ab12]] near [[Bob|cd34]]' }),
    );
    expect(fm.tags).toEqual(['combat', 'id:ab12', 'id:cd34']);
  });

  it('removes entity tags whose wiki links are no longer in the body', () => {
    const fm = bufferToFrontmatter(buf({ tagsText: 'combat, id:ab12', body: '' }));
    expect(fm.tags).toEqual(['combat']);
  });

  it('round-trips through bufferFromEvent', () => {
    const original = buf({
      title: 'Round-trip',
      date: '4726-03-15',
      tagsText: 'a, b',
      color: '#3d7a38',
      body: 'Hello',
    });
    const fm = bufferToFrontmatter(original);
    const ev = event({
      ...fm,
      tags: fm.tags ?? [],
      color: fm.color ?? undefined,
      body: original.body,
    });
    const restored = bufferFromEvent(ev);
    expect(restored.title).toBe(original.title);
    expect(restored.date).toBe(original.date);
    expect(restored.color).toBe(original.color);
    // Tags may have whitespace differences
    expect(restored.tagsText.split(', ').sort()).toEqual(original.tagsText.split(', ').sort());
  });
});

// ---- buildTagChips ----

describe('buildTagChips', () => {
  const resolvedMap = new Map([['ab12', 'Bob the Wizard']]);
  const emptyMap = new Map<string, string>();

  it('returns custom tag chips from tagsText', () => {
    const chips = buildTagChips('combat, plot', '', emptyMap);
    expect(chips).toEqual([
      { raw: 'combat', display: 'combat', isEntity: false },
      { raw: 'plot', display: 'plot', isEntity: false },
    ]);
  });

  it('returns resolved entity chips from wiki links in body', () => {
    const chips = buildTagChips('', '[[ab12]]', resolvedMap);
    expect(chips).toEqual([{ raw: 'id:ab12', display: 'Bob the Wizard', isEntity: true }]);
  });

  it('shows raw id:xxxx when entity is not in the label map', () => {
    const chips = buildTagChips('', '[[zz99]]', emptyMap);
    expect(chips).toEqual([{ raw: 'id:zz99', display: 'id:zz99', isEntity: true }]);
  });

  it('combines custom and entity chips', () => {
    const chips = buildTagChips('combat', '[[ab12]]', resolvedMap);
    expect(chips).toEqual([
      { raw: 'combat', display: 'combat', isEntity: false },
      { raw: 'id:ab12', display: 'Bob the Wizard', isEntity: true },
    ]);
  });

  it('returns empty array when tagsText is empty and body has no wiki links', () => {
    expect(buildTagChips('', '', emptyMap)).toEqual([]);
  });

  it('ignores entity tags that may have been manually typed into tagsText', () => {
    const chips = buildTagChips('id:ab12', '', resolvedMap);
    expect(chips).toEqual([{ raw: 'id:ab12', display: 'id:ab12', isEntity: false }]);
  });
});

// ---- validateBuffer ----

describe('validateBuffer', () => {
  it('returns null for a valid buffer', () => {
    expect(validateBuffer(buf())).toBeNull();
  });

  it('returns error when title is empty', () => {
    expect(validateBuffer(buf({ title: '' }))).toBe('Title is required.');
  });

  it('returns error when title is whitespace only', () => {
    expect(validateBuffer(buf({ title: '   ' }))).toBe('Title is required.');
  });

  it('returns error when date is empty', () => {
    expect(validateBuffer(buf({ date: '' }))).toBe('Date is required.');
  });

  it('returns error when date is invalid Golarian format', () => {
    const err = validateBuffer(buf({ date: 'not-a-date' }));
    expect(err).not.toBeNull();
    expect(err).toMatch(/golarian date/i);
  });

  it('accepts date with time component', () => {
    expect(validateBuffer(buf({ date: '4726-05-04T09:30' }))).toBeNull();
  });
});

// ---- deriveFilename ----

describe('deriveFilename', () => {
  it('derives slug from title and date prefix', () => {
    expect(deriveFilename(buf({ title: 'The Big Heist', date: '4726-05-04T09:30' }))).toBe(
      '4726-05-04-the-big-heist.md',
    );
  });

  it('strips apostrophes from title', () => {
    expect(deriveFilename(buf({ title: "It's Time", date: '4726-05-04' }))).toBe(
      '4726-05-04-its-time.md',
    );
  });

  it('uses "event" fallback when title is blank', () => {
    expect(deriveFilename(buf({ title: '', date: '4726-05-04' }))).toBe('4726-05-04-event.md');
  });

  it('truncates slug at 60 characters', () => {
    const longTitle = 'a'.repeat(80);
    const filename = deriveFilename(buf({ title: longTitle, date: '4726-05-04' }));
    const slug = filename.replace('4726-05-04-', '').replace('.md', '');
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it('replaces non-alphanumeric runs with single dash', () => {
    expect(deriveFilename(buf({ title: 'Battle!!! At Dawn', date: '4726-01-01' }))).toBe(
      '4726-01-01-battle-at-dawn.md',
    );
  });

  it('strips leading/trailing dashes from slug', () => {
    expect(deriveFilename(buf({ title: '---Test---', date: '4726-01-01' }))).toBe(
      '4726-01-01-test.md',
    );
  });
});

// ---- ThemeProvider.get().timeline.eventColorPresets ----

describe('ThemeProvider.get().timeline.eventColorPresets', () => {
  it('contains the default (empty) preset', () => {
    expect(ThemeProvider.get().timeline.eventColorPresets.some((p) => p.value === '')).toBe(true);
  });

  it('contains the custom sentinel', () => {
    expect(
      ThemeProvider.get().timeline.eventColorPresets.some((p) => p.value === '__custom__'),
    ).toBe(true);
  });

  it('has named color presets', () => {
    expect(ThemeProvider.get().timeline.eventColorPresets.some((p) => p.value === '#a83030')).toBe(
      true,
    );
  });
});

// ---- getColorPresetValue ----

describe('getColorPresetValue', () => {
  it('returns empty string for empty color', () => {
    expect(getColorPresetValue('')).toBe('');
  });

  it('returns the preset value when color matches a preset', () => {
    expect(getColorPresetValue('#a83030')).toBe('#a83030');
  });

  it('returns __custom__ for a non-preset hex value', () => {
    expect(getColorPresetValue('#ff1234')).toBe('__custom__');
  });

  it('does not treat __custom__ itself as a valid preset', () => {
    expect(getColorPresetValue('__custom__')).toBe('__custom__');
  });
});
