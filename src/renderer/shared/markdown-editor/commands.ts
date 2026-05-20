/**
 * CM6 command wrappers for the pure markdown toggle / insert functions.
 *
 * Each exported `Command` function:
 *   1. Reads the doc text and selection from the EditorView.
 *   2. Calls the corresponding pure function.
 *   3. Dispatches only the minimal changed range (not a full-doc replacement).
 *   4. Returns true (always handles the event).
 *
 * `formattingKeymap` is an Extension ready to drop into MarkdownEditor's base
 * extensions. The FormatToolbar calls the same Command functions directly
 * against a forwarded EditorView ref.
 */

import { type Extension } from '@codemirror/state';
import { type Command, EditorView, keymap } from '@codemirror/view';
import {
  toggleBold,
  toggleItalic,
  toggleCode,
  toggleStrike,
} from './domain/markdown/toggle-inline';
import {
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleBlockquote,
} from './domain/markdown/toggle-block';
import {
  linkTemplate,
  imageTemplate,
  tableTemplate,
  codeBlockTemplate,
} from './domain/markdown/insert-templates';
import type { TemplateResult } from './domain/markdown/insert-templates';

// ---- Helpers -------------------------------------------------------------

/**
 * Computes the minimal single-range change between two strings.
 * Avoids replacing the full document on every format operation.
 */
function minimalChange(oldText: string, newText: string) {
  let from = 0;
  while (from < oldText.length && from < newText.length && oldText[from] === newText[from]) {
    from++;
  }
  let oldTo = oldText.length;
  let newTo = newText.length;
  while (oldTo > from && newTo > from && oldText[oldTo - 1] === newText[newTo - 1]) {
    oldTo--;
    newTo--;
  }
  return { from, to: oldTo, insert: newText.slice(from, newTo) };
}

type FormatFn = (
  text: string,
  from: number,
  to: number,
) => { text: string; from: number; to: number };

function makeToggleCommand(fn: FormatFn): Command {
  return (view: EditorView) => {
    const text = view.state.doc.toString();
    const { from, to } = view.state.selection.main;
    const result = fn(text, from, to);
    const change = minimalChange(text, result.text);
    view.dispatch({
      changes: change,
      selection: { anchor: result.from, head: result.to },
      userEvent: 'input.format',
    });
    return true;
  };
}

function makeInsertCommand(templateFn: () => TemplateResult): Command {
  return (view: EditorView) => {
    const pos = view.state.selection.main.head;
    const { insert, selectFrom, selectTo } = templateFn();
    view.dispatch({
      changes: { from: pos, to: pos, insert },
      selection: { anchor: pos + selectFrom, head: pos + selectTo },
      userEvent: 'input.format',
    });
    return true;
  };
}

// ---- Inline commands -----------------------------------------------------

export const boldCommand = makeToggleCommand(toggleBold);
export const italicCommand = makeToggleCommand(toggleItalic);
export const codeCommand = makeToggleCommand(toggleCode);
export const strikeCommand = makeToggleCommand(toggleStrike);

// ---- Block commands ------------------------------------------------------

export const headingCommand = makeToggleCommand(toggleHeading);
export const bulletListCommand = makeToggleCommand(toggleBulletList);
export const orderedListCommand = makeToggleCommand(toggleOrderedList);
export const blockquoteCommand = makeToggleCommand(toggleBlockquote);

// ---- Insert commands -----------------------------------------------------

/** Link insert: if text is selected, use it as the label and place cursor on the url placeholder.
 *  If no selection, insert the full template with "label" selected for immediate typing. */
export const insertLinkCommand: Command = (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  const selected = from < to ? view.state.doc.sliceString(from, to) : '';
  if (selected) {
    const insert = `[${selected}](url)`;
    const urlOffset = 1 + selected.length + 2; // after '[selected]('
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + urlOffset, head: from + urlOffset + 3 },
      userEvent: 'input.format',
    });
  } else {
    const { insert, selectFrom, selectTo } = linkTemplate();
    view.dispatch({
      changes: { from, to: from, insert },
      selection: { anchor: from + selectFrom, head: from + selectTo },
      userEvent: 'input.format',
    });
  }
  return true;
};
export const insertImageCommand = makeInsertCommand(imageTemplate);
export const insertTableCommand = makeInsertCommand(tableTemplate);
export const insertCodeBlockCommand = makeInsertCommand(() => codeBlockTemplate());

// ---- Keymap extension ----------------------------------------------------

export const formattingKeymap: Extension = keymap.of([
  { key: 'Ctrl-b', mac: 'Cmd-b', run: boldCommand },
  { key: 'Ctrl-i', mac: 'Cmd-i', run: italicCommand },
  { key: 'Ctrl-`', run: codeCommand },
  { key: 'Ctrl-Shift-s', mac: 'Cmd-Shift-s', run: strikeCommand },
  { key: 'Ctrl-Shift-8', mac: 'Cmd-Shift-8', run: bulletListCommand },
  { key: 'Ctrl-Shift-7', mac: 'Cmd-Shift-7', run: orderedListCommand },
  { key: 'Ctrl-Shift-.', mac: 'Cmd-Shift-.', run: blockquoteCommand },
]);
