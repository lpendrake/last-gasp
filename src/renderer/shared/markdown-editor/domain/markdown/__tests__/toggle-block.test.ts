import { describe, it, expect } from 'vitest';
import {
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleBlockquote,
  linesInRange,
} from '../toggle-block';

// ---- linesInRange --------------------------------------------------------

describe('linesInRange', () => {
  it('returns the single line containing a caret', () => {
    const lines = linesInRange('foo\nbar\nbaz', 4, 4);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('bar');
  });

  it('returns all lines overlapping a multi-line selection', () => {
    const lines = linesInRange('foo\nbar\nbaz', 0, 7);
    expect(lines.map((l) => l.text)).toEqual(['foo', 'bar']);
  });

  it('does not include a line when selection ends exactly at its preceding newline', () => {
    // to=3 is the position of '\n' between "foo" and "bar"; "bar" starts at 4
    const lines = linesInRange('foo\nbar', 0, 3);
    expect(lines.map((l) => l.text)).toEqual(['foo']);
  });

  it('handles a single-line document', () => {
    const lines = linesInRange('hello', 0, 5);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('hello');
  });
});

// ---- toggleHeading -------------------------------------------------------

describe('toggleHeading', () => {
  it('paragraph → H1', () => {
    expect(toggleHeading('foo', 0, 3).text).toBe('# foo');
  });

  it('H1 → H2', () => {
    expect(toggleHeading('# foo', 0, 5).text).toBe('## foo');
  });

  it('H2 → H3', () => {
    expect(toggleHeading('## foo', 0, 6).text).toBe('### foo');
  });

  it('H3 → paragraph', () => {
    expect(toggleHeading('### foo', 0, 7).text).toBe('foo');
  });

  it('cycles para → H1 → H2 → H3 → para', () => {
    let text = 'foo';
    text = toggleHeading(text, 0, text.length).text; // → '# foo'
    expect(text).toBe('# foo');
    text = toggleHeading(text, 0, text.length).text; // → '## foo'
    expect(text).toBe('## foo');
    text = toggleHeading(text, 0, text.length).text; // → '### foo'
    expect(text).toBe('### foo');
    text = toggleHeading(text, 0, text.length).text; // → 'foo'
    expect(text).toBe('foo');
  });

  it('applies to every line in a multi-line selection', () => {
    const doc = 'foo\nbar';
    const { text } = toggleHeading(doc, 0, 7);
    expect(text).toBe('# foo\n# bar');
  });

  it('returned from/to spans the modified region', () => {
    const { from, to, text } = toggleHeading('foo', 0, 3);
    expect(text.slice(from, to)).toBe('# foo');
  });
});

// ---- toggleBulletList ----------------------------------------------------

describe('toggleBulletList', () => {
  it('adds "- " to a plain line', () => {
    expect(toggleBulletList('foo', 0, 3).text).toBe('- foo');
  });

  it('removes "- " when the line is already bulleted', () => {
    expect(toggleBulletList('- foo', 0, 5).text).toBe('foo');
  });

  it('adds "- " uniformly to all selected lines', () => {
    const doc = 'foo\nbar\nbaz';
    expect(toggleBulletList(doc, 0, 11).text).toBe('- foo\n- bar\n- baz');
  });

  it('removes "- " uniformly when all selected lines are bulleted', () => {
    const doc = '- foo\n- bar\n- baz';
    expect(toggleBulletList(doc, 0, 17).text).toBe('foo\nbar\nbaz');
  });

  it('adds to mixed selection (not all bulleted)', () => {
    const doc = '- foo\nbar';
    // "bar" is not bulleted, so the whole selection gets "- " added
    expect(toggleBulletList(doc, 0, 9).text).toBe('- - foo\n- bar');
  });
});

// ---- toggleOrderedList ---------------------------------------------------

describe('toggleOrderedList', () => {
  it('adds "1. " to a plain line', () => {
    expect(toggleOrderedList('foo', 0, 3).text).toBe('1. foo');
  });

  it('removes ordered prefix when line is already ordered', () => {
    expect(toggleOrderedList('1. foo', 0, 6).text).toBe('foo');
  });

  it('numbers multiple lines sequentially', () => {
    const doc = 'foo\nbar\nbaz';
    expect(toggleOrderedList(doc, 0, 11).text).toBe('1. foo\n2. bar\n3. baz');
  });

  it('removes ordered prefix from all lines when all are ordered', () => {
    const doc = '1. foo\n2. bar\n3. baz';
    expect(toggleOrderedList(doc, 0, 20).text).toBe('foo\nbar\nbaz');
  });
});

// ---- toggleBlockquote ----------------------------------------------------

describe('toggleBlockquote', () => {
  it('adds "> " to a plain line (depth 0 → 1)', () => {
    expect(toggleBlockquote('foo', 0, 3).text).toBe('> foo');
  });

  it('stacks: applying twice gives ">> "', () => {
    const once = toggleBlockquote('foo', 0, 3);
    const twice = toggleBlockquote(once.text, once.from, once.to);
    expect(twice.text).toBe('>> foo');
  });

  it('removes one level when depth ≥ 2', () => {
    const { text } = toggleBlockquote('>> foo', 0, 6);
    expect(text).toBe('> foo');
  });

  it('applies to all lines in a multi-line selection', () => {
    const doc = 'foo\nbar';
    expect(toggleBlockquote(doc, 0, 7).text).toBe('> foo\n> bar');
  });

  it('stacks independently on each line', () => {
    const doc = '> foo\n> bar';
    // depth 1 on both lines → add → '>> foo\n>> bar'
    expect(toggleBlockquote(doc, 0, 11).text).toBe('>> foo\n>> bar');
  });
});
