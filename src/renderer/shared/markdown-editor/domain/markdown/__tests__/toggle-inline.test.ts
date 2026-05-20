import { describe, it, expect } from 'vitest';
import { toggleBold, toggleItalic, toggleCode, toggleStrike, toggleInline } from '../toggle-inline';

// Helper: build a call where [from,to] selects `content` inside `text`
// by locating the first occurrence of `content` in `text`.
function sel(text: string, content: string) {
  const from = text.indexOf(content);
  const to = from + content.length;
  return { text, from, to };
}

describe('toggleBold', () => {
  it('wraps plain selection with **', () => {
    const { text, from, to } = toggleBold('foo', 0, 3);
    expect(text).toBe('**foo**');
    expect(from).toBe(2);
    expect(to).toBe(5);
  });

  it('unwraps when selection is already bold', () => {
    const s = sel('**foo**', 'foo');
    const { text, from, to } = toggleBold(s.text, s.from, s.to);
    expect(text).toBe('foo');
    expect(from).toBe(0);
    expect(to).toBe(3);
  });

  it('stacks: bold over italic becomes ***', () => {
    const s = sel('*foo*', 'foo');
    const { text, from, to } = toggleBold(s.text, s.from, s.to);
    expect(text).toBe('***foo***');
    expect(from).toBe(3);
    expect(to).toBe(6);
  });

  it('unstacks: bold off triple keeps italic', () => {
    const s = sel('***foo***', 'foo');
    const { text, from, to } = toggleBold(s.text, s.from, s.to);
    expect(text).toBe('*foo*');
    expect(from).toBe(1);
    expect(to).toBe(4);
  });

  it('caret-only insert leaves caret between markers', () => {
    const { text, from, to } = toggleBold('ab', 1, 1);
    expect(text).toBe('a****b');
    // caret sits between the two ** pairs
    expect(from).toBe(3);
    expect(to).toBe(3);
  });

  it('wraps selection with surrounding text untouched', () => {
    const { text } = toggleBold('hello world goodbye', 6, 11);
    expect(text).toBe('hello **world** goodbye');
  });
});

describe('toggleItalic', () => {
  it('wraps plain selection with *', () => {
    const { text, from, to } = toggleItalic('foo', 0, 3);
    expect(text).toBe('*foo*');
    expect(from).toBe(1);
    expect(to).toBe(4);
  });

  it('unwraps when selection is already italic', () => {
    const s = sel('*foo*', 'foo');
    const { text } = toggleItalic(s.text, s.from, s.to);
    expect(text).toBe('foo');
  });

  it('stacks: italic over bold becomes ***', () => {
    const s = sel('**foo**', 'foo');
    const { text, from, to } = toggleItalic(s.text, s.from, s.to);
    expect(text).toBe('***foo***');
    expect(from).toBe(3);
    expect(to).toBe(6);
  });

  it('unstacks: italic off triple keeps bold', () => {
    const s = sel('***foo***', 'foo');
    const { text } = toggleItalic(s.text, s.from, s.to);
    expect(text).toBe('**foo**');
  });

  it('caret-only insert leaves caret between markers', () => {
    const { text, from, to } = toggleItalic('', 0, 0);
    expect(text).toBe('**');
    expect(from).toBe(1);
    expect(to).toBe(1);
  });
});

describe('toggleStrike', () => {
  it('wraps plain selection with ~~', () => {
    const { text, from, to } = toggleStrike('foo', 0, 3);
    expect(text).toBe('~~foo~~');
    expect(from).toBe(2);
    expect(to).toBe(5);
  });

  it('unwraps when already struck', () => {
    const s = sel('~~foo~~', 'foo');
    const { text } = toggleStrike(s.text, s.from, s.to);
    expect(text).toBe('foo');
  });

  it('wraps even when bold is also present', () => {
    // Bold and strikethrough are independent — no stacking interaction
    const s = sel('**foo**', 'foo');
    const { text } = toggleStrike(s.text, s.from, s.to);
    expect(text).toBe('**~~foo~~**');
  });

  it('caret-only insert leaves caret between markers', () => {
    const { text, from, to } = toggleStrike('', 0, 0);
    expect(text).toBe('~~~~');
    expect(from).toBe(2);
    expect(to).toBe(2);
  });
});

describe('toggleCode', () => {
  it('wraps plain selection with backtick', () => {
    const { text, from, to } = toggleCode('foo', 0, 3);
    expect(text).toBe('`foo`');
    expect(from).toBe(1);
    expect(to).toBe(4);
  });

  it('unwraps when already code', () => {
    const s = sel('`foo`', 'foo');
    const { text, from, to } = toggleCode(s.text, s.from, s.to);
    expect(text).toBe('foo');
    expect(from).toBe(0);
    expect(to).toBe(3);
  });

  it('caret-only insert leaves caret between backticks', () => {
    const { text, from, to } = toggleCode('', 0, 0);
    expect(text).toBe('``');
    expect(from).toBe(1);
    expect(to).toBe(1);
  });

  it('does not interact with surrounding * markers', () => {
    // Code wrapping inside bold should add backticks inside the **
    const s = sel('**foo**', 'foo');
    const { text } = toggleCode(s.text, s.from, s.to);
    expect(text).toBe('**`foo`**');
  });
});

describe('toggleInline — generic marker', () => {
  it('accepts ** as marker', () => {
    expect(toggleInline('foo', 0, 3, '**').text).toBe('**foo**');
  });

  it('accepts * as marker', () => {
    expect(toggleInline('foo', 0, 3, '*').text).toBe('*foo*');
  });

  it('accepts ` as marker', () => {
    expect(toggleInline('foo', 0, 3, '`').text).toBe('`foo`');
  });

  it('accepts ~~ as marker', () => {
    expect(toggleInline('foo', 0, 3, '~~').text).toBe('~~foo~~');
  });
});
