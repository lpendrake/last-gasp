/**
 * Block-level markdown toggle operations.
 *
 * All functions share the same shape:
 *   fn(text, from, to) → { text, from, to }
 *
 * where [from, to] are character positions (not line numbers).
 * The returned [from, to] covers the full replaced region in the new text
 * (start of first affected line → end of last affected line).
 *
 * Lines are determined by which lines have content overlapping [from, to].
 * A caret (from === to) targets the single line containing the cursor.
 */

export interface BlockResult {
  text: string;
  from: number;
  to: number;
}

// ---- Line helpers --------------------------------------------------------

interface LineInfo {
  from: number; // position of first char on the line
  to: number; // position just after last char (exclusive of '\n')
  text: string;
}

/** Returns all lines whose content overlaps with [from, to]. */
export function linesInRange(docText: string, from: number, to: number): LineInfo[] {
  const result: LineInfo[] = [];
  let pos = 0;
  for (const lineText of docText.split('\n')) {
    const lineFrom = pos;
    const lineTo = pos + lineText.length;
    if (from <= lineTo && to >= lineFrom) {
      result.push({ from: lineFrom, to: lineTo, text: lineText });
    }
    pos = lineTo + 1; // +1 skips the '\n'
    if (pos > to + 1) break;
  }
  return result;
}

/**
 * Applies `transform` to every line in [from, to], rebuilds the document,
 * and returns adjusted positions that span the entire modified block.
 */
function applyToLines(
  text: string,
  from: number,
  to: number,
  transform: (line: string) => string,
): BlockResult {
  const lines = linesInRange(text, from, to);
  if (lines.length === 0) return { text, from, to };

  const blockFrom = lines[0].from;
  const blockTo = lines[lines.length - 1].to;

  const newBlock = lines.map((l) => transform(l.text)).join('\n');
  const newText = text.slice(0, blockFrom) + newBlock + text.slice(blockTo);

  return { text: newText, from: blockFrom, to: blockFrom + newBlock.length };
}

// ---- Heading -------------------------------------------------------------

/**
 * Cycles the heading level of each selected line:
 *   paragraph → H1 → H2 → H3 → paragraph
 */
export function toggleHeading(text: string, from: number, to: number): BlockResult {
  return applyToLines(text, from, to, cycleHeadingLine);
}

function cycleHeadingLine(line: string): string {
  if (line.startsWith('### ')) return line.slice(4); // H3 → paragraph
  if (line.startsWith('## ')) return '### ' + line.slice(3); // H2 → H3
  if (line.startsWith('# ')) return '## ' + line.slice(2); // H1 → H2
  return '# ' + line; // paragraph → H1
}

// ---- Bullet list ---------------------------------------------------------

/**
 * If every selected line starts with '- ', removes it from all.
 * Otherwise prepends '- ' to every line.
 */
export function toggleBulletList(text: string, from: number, to: number): BlockResult {
  const lines = linesInRange(text, from, to);
  const allBullet = lines.length > 0 && lines.every((l) => l.text.startsWith('- '));
  return applyToLines(text, from, to, (line) => (allBullet ? line.slice(2) : '- ' + line));
}

// ---- Ordered list --------------------------------------------------------

/**
 * If every selected line matches /^\d+\. /, removes the prefix from all.
 * Otherwise prepends '1. ', '2. ', '3. ' etc.
 */
export function toggleOrderedList(text: string, from: number, to: number): BlockResult {
  const lines = linesInRange(text, from, to);
  const allOrdered = lines.length > 0 && lines.every((l) => /^\d+\. /.test(l.text));

  if (allOrdered) {
    return applyToLines(text, from, to, (line) => line.replace(/^\d+\. /, ''));
  }

  let counter = 1;
  return applyToLines(text, from, to, (line) => `${counter++}. ${line}`);
}

// ---- Blockquote ----------------------------------------------------------

/**
 * Stacks '> ' prefixes on each selected line.
 *
 * Rules per line:
 * - depth 0 or 1 → add one level  (depth 0 → '> foo', depth 1 → '>> foo')
 * - depth ≥ 2   → remove one level ('>> foo' → '> foo')
 *
 * This means: applying once adds, applying twice stacks to '>> ',
 * applying a third time removes one level back to '> '.
 * You cannot remove the last '> ' via this toggle alone.
 */
export function toggleBlockquote(text: string, from: number, to: number): BlockResult {
  return applyToLines(text, from, to, toggleBlockquoteLine);
}

/**
 * Parse a line into its blockquote depth and bare content.
 * Handles the compact `>> foo` format (consecutive `>` chars).
 * A single optional space after the last `>` is consumed.
 */
function parseBlockquote(line: string): { depth: number; content: string } {
  let depth = 0;
  let i = 0;
  while (i < line.length && line[i] === '>') {
    depth++;
    i++;
  }
  if (i < line.length && line[i] === ' ') {
    i++;
  }
  return { depth, content: line.slice(i) };
}

function toggleBlockquoteLine(line: string): string {
  const { depth, content } = parseBlockquote(line);
  const newDepth = depth >= 2 ? depth - 1 : depth + 1;
  return newDepth === 0 ? content : '>'.repeat(newDepth) + ' ' + content;
}
