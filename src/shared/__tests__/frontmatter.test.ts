import { describe, it, expect } from 'vitest';
import { parseNote, stringifyNote, splitFrontmatter, joinFrontmatter } from '../frontmatter';

describe('parseNote', () => {
  it('returns existing id and title unchanged when both present', () => {
    const content = '---\nid: abc1\ntitle: My Note\n---\n\n# My Note\n\nContent here.';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.id).toBe('abc1');
    expect(frontmatter.title).toBe('My Note');
    expect(needsWrite).toBe(false);
  });

  it('generates id when missing and sets needsWrite', () => {
    const content = '---\ntitle: My Note\n---\n\n# My Note\n';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.id).toHaveLength(4);
    expect(frontmatter.id).toMatch(/^[a-z0-9]{4}$/);
    expect(needsWrite).toBe(true);
  });

  it('generates title from H1 when missing and sets needsWrite', () => {
    const content = '---\nid: abc1\n---\n\n# My Note From H1\n';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.title).toBe('My Note From H1');
    expect(needsWrite).toBe(true);
  });

  it('falls back to provided fallbackTitle when no H1', () => {
    const content = '---\nid: abc1\n---\n\nSome content without heading.';
    const { frontmatter } = parseNote(content, 'fallback-title');
    expect(frontmatter.title).toBe('fallback-title');
  });

  it('uses data.name as title when data.title is absent and there is no H1', () => {
    const content = '---\nid: abc1\nname: Named Note\n---\n';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.title).toBe('Named Note');
    expect(needsWrite).toBe(false);
  });

  it('uses H1 over frontmatter title when they match', () => {
    const content = '---\nid: abc1\ntitle: My Note\n---\n\n# My Note\n\nContent.';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.title).toBe('My Note');
    expect(needsWrite).toBe(false);
  });

  it('updates title from H1 when H1 diverges from frontmatter title and sets needsWrite', () => {
    const content = '---\nid: abc1\ntitle: Old Title\n---\n\n# New Title\n\nContent.';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.title).toBe('New Title');
    expect(needsWrite).toBe(true);
  });

  it('keeps frontmatter title when no H1 is present', () => {
    const content = '---\nid: abc1\ntitle: Frontmatter Title\n---\n\nNo heading here.';
    const { frontmatter, needsWrite } = parseNote(content, 'fallback');
    expect(frontmatter.title).toBe('Frontmatter Title');
    expect(needsWrite).toBe(false);
  });

  it('preserves extra frontmatter fields', () => {
    const content = '---\nid: abc1\ntitle: Test\ntags:\n  - foo\n  - bar\n---\n';
    const { frontmatter } = parseNote(content, 'fallback');
    expect(frontmatter.tags).toEqual(['foo', 'bar']);
  });

  it('handles content with no frontmatter at all', () => {
    const content = '# Plain Note\n\nSome text.';
    const { frontmatter, needsWrite } = parseNote(content, 'plain');
    expect(frontmatter.id).toHaveLength(4);
    expect(frontmatter.title).toBe('Plain Note');
    expect(needsWrite).toBe(true);
  });

  it('handles completely empty content', () => {
    const { frontmatter, needsWrite } = parseNote('', 'empty');
    expect(frontmatter.id).toHaveLength(4);
    expect(frontmatter.title).toBe('empty');
    expect(needsWrite).toBe(true);
  });
});

describe('stringifyNote', () => {
  it('round-trips frontmatter and body through parseNote', () => {
    const body = '\nHello world.\n';
    const fm = { id: 'abc1', title: 'Test' };
    const result = stringifyNote(body, fm);
    const { frontmatter, needsWrite } = parseNote(result, 'fallback');
    expect(frontmatter.id).toBe('abc1');
    expect(frontmatter.title).toBe('Test');
    expect(needsWrite).toBe(false);
  });

  it('preserves extra fields in round-trip', () => {
    const body = '\ncontent\n';
    const fm = { id: 'xyz9', title: 'Extra', tags: ['a', 'b'] };
    const result = stringifyNote(body, fm);
    const { frontmatter } = parseNote(result, 'fallback');
    expect(frontmatter.tags).toEqual(['a', 'b']);
  });
});

describe('splitFrontmatter', () => {
  it('splits a file with frontmatter into yaml and body', () => {
    const raw = '---\nid: abc1\ntitle: Test\n---\nBody content here.';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('id: abc1\ntitle: Test');
    expect(body).toBe('Body content here.');
  });

  it('returns empty frontmatter and full raw as body when no frontmatter block', () => {
    const raw = '# Just a heading\n\nSome text.';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('');
    expect(body).toBe(raw);
  });

  it('handles empty string', () => {
    const { frontmatter, body } = splitFrontmatter('');
    expect(frontmatter).toBe('');
    expect(body).toBe('');
  });

  it('does not match a frontmatter block that lacks a trailing newline after ---', () => {
    const raw = '---\nid: abc1\n---no-newline';
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toBe('');
    expect(body).toBe(raw);
  });
});

describe('joinFrontmatter', () => {
  it('combines frontmatter and body into a file string', () => {
    const result = joinFrontmatter('id: abc1\ntitle: Test', 'Body here.');
    expect(result).toBe('---\nid: abc1\ntitle: Test\n---\nBody here.');
  });

  it('returns just the body when frontmatter is empty', () => {
    expect(joinFrontmatter('', 'Body only.')).toBe('Body only.');
  });

  it('returns just the body when frontmatter is whitespace-only', () => {
    expect(joinFrontmatter('   ', 'Body only.')).toBe('Body only.');
  });

  it('roundtrips through split then join', () => {
    const original = '---\nid: abc1\ntitle: Test\n---\nBody content.';
    const { frontmatter, body } = splitFrontmatter(original);
    expect(joinFrontmatter(frontmatter, body)).toBe(original);
  });
});
