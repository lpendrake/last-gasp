/**
 * Markdown insertion templates.
 *
 * Each function returns { insert, selectFrom, selectTo } where:
 * - insert:     the string to insert at the cursor position
 * - selectFrom: offset from the insertion point where the post-insert selection starts
 * - selectTo:   offset from the insertion point where the post-insert selection ends
 *
 * When selectFrom === selectTo the cursor is placed at that offset (no selection).
 * The CM6 command layer adds these offsets to the insertion position to set the selection.
 */

export interface TemplateResult {
  insert: string;
  selectFrom: number;
  selectTo: number;
}

/** Inline link: [label](url) — selects "label" so the user can type over it. */
export function linkTemplate(): TemplateResult {
  return { insert: '[label](url)', selectFrom: 1, selectTo: 6 };
}

/** Inline image: ![alt](path) — selects "alt" so the user can type over it. */
export function imageTemplate(): TemplateResult {
  return { insert: '![alt](path)', selectFrom: 2, selectTo: 5 };
}

/** Three-column starter table — selects the first header cell. */
export function tableTemplate(): TemplateResult {
  const insert =
    '| Header | Header | Header |\n' +
    '| ------ | ------ | ------ |\n' +
    '| Cell   | Cell   | Cell   |';
  // Offset 2 is the space after the first '|', "Header" runs from 2 to 8.
  return { insert, selectFrom: 2, selectTo: 8 };
}

/**
 * Fenced code block — places the cursor on the blank line between the fences
 * so the user can start typing immediately.
 *
 * @param lang  Optional language identifier (e.g. 'ts', 'python').
 */
export function codeBlockTemplate(lang = ''): TemplateResult {
  const insert = `\`\`\`${lang}\n\n\`\`\``;
  // Cursor on the blank line: after "```lang\n" (= 3 + lang.length + 1 chars).
  const cursor = 3 + lang.length + 1;
  return { insert, selectFrom: cursor, selectTo: cursor };
}
