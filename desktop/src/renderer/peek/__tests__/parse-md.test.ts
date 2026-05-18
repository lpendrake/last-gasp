import { describe, it, expect } from 'vitest';
import { parseMd } from '../parse-md';

describe('parseMd', () => {
  it('extracts frontmatter title and strips frontmatter from body', () => {
    const raw = '---\ntitle: Bob\n---\nBody text';
    const result = parseMd('notes/npcs/bob.md', raw);
    expect(result.title).toBe('Bob');
    expect(result.body).toBe('Body text');
    expect(result.baseDir).toBe('notes/npcs');
    expect(result.body).not.toMatch(/^---/);
  });

  it('strips single quotes from frontmatter title', () => {
    const raw = "---\ntitle: 'Bob the Wizard'\n---\nx";
    expect(parseMd('notes/foo.md', raw).title).toBe('Bob the Wizard');
  });

  it('strips double quotes from frontmatter title', () => {
    const raw = '---\ntitle: "Bob the Wizard"\n---\nx';
    expect(parseMd('notes/foo.md', raw).title).toBe('Bob the Wizard');
  });

  it('falls back to H1 when no frontmatter', () => {
    const raw = '# Hello World\n\nbody';
    const result = parseMd('notes/foo.md', raw);
    expect(result.title).toBe('Hello World');
    expect(result.body).toContain('# Hello World');
  });

  it('falls back to filename when no frontmatter and no H1', () => {
    expect(parseMd('notes/foo.md', 'Just some text').title).toBe('foo');
  });

  it('falls back to filename when frontmatter has no title field', () => {
    const raw = '---\nslug: foo\n---\nbody';
    expect(parseMd('notes/bar.md', raw).title).toBe('bar');
  });

  it('derives nested baseDir correctly', () => {
    expect(parseMd('notes/npcs/sub/bob.md', '').baseDir).toBe('notes/npcs/sub');
  });

  it('derives top-level baseDir correctly', () => {
    expect(parseMd('timeline/event.md', '').baseDir).toBe('timeline');
  });

  it('handles empty file without throwing', () => {
    const result = parseMd('notes/foo.md', '');
    expect(result.title).toBe('foo');
    expect(result.body).toBe('');
    expect(result.baseDir).toBe('notes');
  });

  it('treats frontmatter without closing fence as plain text', () => {
    const raw = '---\ntitle: Foo\nnobody';
    const result = parseMd('notes/bar.md', raw);
    expect(result.title).toBe('bar');
  });
});
