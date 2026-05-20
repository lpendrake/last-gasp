import { describe, it, expect } from 'vitest';
import { linkTemplate, imageTemplate, tableTemplate, codeBlockTemplate } from '../insert-templates';

describe('linkTemplate', () => {
  it('inserts standard markdown link syntax', () => {
    const { insert } = linkTemplate();
    expect(insert).toBe('[label](url)');
  });

  it('selectFrom/selectTo covers "label"', () => {
    const { insert, selectFrom, selectTo } = linkTemplate();
    expect(insert.slice(selectFrom, selectTo)).toBe('label');
  });
});

describe('imageTemplate', () => {
  it('inserts standard markdown image syntax', () => {
    const { insert } = imageTemplate();
    expect(insert).toBe('![alt](path)');
  });

  it('selectFrom/selectTo covers "alt"', () => {
    const { insert, selectFrom, selectTo } = imageTemplate();
    expect(insert.slice(selectFrom, selectTo)).toBe('alt');
  });
});

describe('tableTemplate', () => {
  it('inserts a valid markdown table with header and one data row', () => {
    const { insert } = tableTemplate();
    const lines = insert.split('\n');
    // Row 1: header, Row 2: separator, Row 3: data
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^\|[\s\-|]+\|$/); // separator row
  });

  it('selectFrom/selectTo covers the first "Header" cell content', () => {
    const { insert, selectFrom, selectTo } = tableTemplate();
    expect(insert.slice(selectFrom, selectTo)).toBe('Header');
  });
});

describe('codeBlockTemplate', () => {
  it('inserts fenced code block without language', () => {
    const { insert } = codeBlockTemplate();
    expect(insert).toBe('```\n\n```');
  });

  it('inserts fenced code block with language tag', () => {
    const { insert } = codeBlockTemplate('ts');
    expect(insert.startsWith('```ts')).toBe(true);
    expect(insert.endsWith('```')).toBe(true);
  });

  it('cursor lands on the blank line between fences (caret, not selection)', () => {
    const { insert, selectFrom, selectTo } = codeBlockTemplate();
    expect(selectFrom).toBe(selectTo); // cursor, not selection
    // The blank line is at index 4 ("```\n" is 4 chars, then blank line)
    expect(selectFrom).toBe(4);
    expect(insert[selectFrom]).toBe('\n'); // the closing fence follows
  });

  it('cursor offset accounts for language length', () => {
    const { selectFrom, selectTo } = codeBlockTemplate('python');
    expect(selectFrom).toBe(selectTo);
    // "```python\n" = 3 + 6 + 1 = 10 chars
    expect(selectFrom).toBe(10);
  });
});
