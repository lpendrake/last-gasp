/*
 * Portions of this code are derived from atomic-editor (MIT) by kenforthewin
 */

import { RangeSet, StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export function markdownDecorations(): Extension {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state);
    },
    update(value, transaction) {
      if (transaction.docChanged || transaction.selection) {
        return buildDecorations(transaction.state);
      }
      return value.map(transaction.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

/**
 * Returns true when cursorHead is inside [from, to] (inclusive on both ends).
 * Used to decide whether to reveal hidden syntax markers near the cursor.
 * The check is strict: being at the \n before an element does NOT count as near.
 */
export function isCursorNear(cursorHead: number, from: number, to: number): boolean {
  return cursorHead >= from && cursorHead <= to;
}

function buildDecorations(state: EditorState): DecorationSet {
  const selection = state.selection.main;
  const cursorHead = selection.head;
  const decorations: { from: number; to: number; decoration: Decoration }[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      const parent = node.node.parent;
      const parentName = parent?.name ?? '';
      // For marks: reveal when cursor is near the containing element (parent), not just anywhere on the line
      const nearCursor = isCursorNear(cursorHead, parent?.from ?? node.from, parent?.to ?? node.to);

      // Headings — always styled; mark hidden unless cursor is on this heading
      if (node.name === 'HeaderMark') {
        if (!nearCursor) {
          // Also hide the space that follows the # mark to avoid visual indent
          const hasTrailingSpace = state.doc.sliceString(node.to, node.to + 1) === ' ';
          const replaceTo = node.to + (hasTrailingSpace ? 1 : 0);
          decorations.push({ from: node.from, to: replaceTo, decoration: Decoration.replace({}) });
        }
      }
      if (node.name.startsWith('ATXHeading')) {
        const level = parseInt(node.name.slice(10));
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({ class: `cm-heading-${level}` }),
        });
      }

      // Emphasis / Strong — marks hidden unless cursor is inside the span
      if (node.name === 'EmphasisMark' || node.name === 'StrongEmphasisMark') {
        if (!nearCursor) {
          decorations.push({ from: node.from, to: node.to, decoration: Decoration.replace({}) });
        }
      }

      // Lists
      if (node.name === 'ListMark') {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({ class: 'cm-list-mark' }),
        });
      }

      // Inline code — always styled; backticks hidden unless cursor is inside the span
      if (node.name === 'InlineCode') {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({ class: 'cm-inline-code' }),
        });
      }
      if (node.name === 'CodeMark' && parentName === 'InlineCode') {
        if (!nearCursor) {
          decorations.push({ from: node.from, to: node.to, decoration: Decoration.replace({}) });
        }
      }

      // Strikethrough (GFM) — always styled; marks hidden unless cursor is inside the span
      if (node.name === 'Strikethrough') {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({ class: 'cm-strikethrough' }),
        });
      }
      if (node.name === 'StrikethroughMark') {
        if (!nearCursor) {
          decorations.push({ from: node.from, to: node.to, decoration: Decoration.replace({}) });
        }
      }

      // Blockquote — left-border styling on every line; '>' hidden unless cursor is in the block
      if (node.name === 'Blockquote') {
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);
        for (let ln = startLine.number; ln <= endLine.number; ln++) {
          const lineFrom = state.doc.line(ln).from;
          decorations.push({
            from: lineFrom,
            to: lineFrom,
            decoration: Decoration.line({ class: 'cm-blockquote' }),
          });
        }
      }
      if (node.name === 'QuoteMark') {
        if (nearCursor) {
          decorations.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: 'cm-blockquote-mark' }),
          });
        } else {
          // Hide '>' and the single space that follows it
          const hasTrailingSpace = state.doc.sliceString(node.to, node.to + 1) === ' ';
          const replaceTo = node.to + (hasTrailingSpace ? 1 : 0);
          decorations.push({ from: node.from, to: replaceTo, decoration: Decoration.replace({}) });
        }
      }

      // Tables — distinct line styles for header, separator, and data rows
      if (node.name === 'TableHeader') {
        const line = state.doc.lineAt(node.from);
        decorations.push({
          from: line.from,
          to: line.from,
          decoration: Decoration.line({ class: 'cm-table-header' }),
        });
      }
      if (node.name === 'TableDelimiter' && parentName === 'Table') {
        // The full '| --- |' separator row (pipes within cells also use TableDelimiter,
        // but their parent is TableHeader/TableRow, not Table itself)
        const line = state.doc.lineAt(node.from);
        decorations.push({
          from: line.from,
          to: line.from,
          decoration: Decoration.line({ class: 'cm-table-sep' }),
        });
      }
      if (node.name === 'TableRow') {
        const line = state.doc.lineAt(node.from);
        decorations.push({
          from: line.from,
          to: line.from,
          decoration: Decoration.line({ class: 'cm-table-row' }),
        });
      }

      // Fenced code — Decoration.line for full-width background (mark would hug text width per line)
      if (node.name === 'FencedCode') {
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);
        for (let ln = startLine.number; ln <= endLine.number; ln++) {
          const lineStart = state.doc.line(ln).from;
          decorations.push({
            from: lineStart,
            to: lineStart,
            decoration: Decoration.line({ class: 'cm-fenced-code' }),
          });
        }
      }
      if (node.name === 'CodeMark' && parentName === 'FencedCode') {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({ class: 'cm-code-fence-mark' }),
        });
      }

      // Markdown links — always styled; brackets/URL hidden unless cursor is inside the span.
      // Skip Link nodes that are the inner part of a wiki-link [[...]] — the character
      // immediately before a wiki-link's inner Link is '[', distinguishing it from a real
      // markdown link. Return false to also skip the node's children (LinkMark, URL, etc.)
      // so they don't conflict with the Decoration.replace applied by the wiki-link extension.
      if (node.name === 'Link') {
        const charBefore = node.from > 0 ? state.doc.sliceString(node.from - 1, node.from) : '';
        if (charBefore === '[') return false;
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({ class: 'cm-md-link' }),
        });
      }
      if ((node.name === 'LinkMark' || node.name === 'URL') && parentName === 'Link') {
        if (!nearCursor) {
          decorations.push({ from: node.from, to: node.to, decoration: Decoration.replace({}) });
        }
      }
    },
  });

  const ranges = decorations
    .filter((d) => d.from <= d.to)
    .map((d) => d.decoration.range(d.from, d.to));

  return RangeSet.of(ranges, true);
}
