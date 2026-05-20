import type { LinkIndexEntry } from '../../../data/types.ts';
import { escHtml, renderInline } from './inline.ts';

export type ClassifiedLine =
  | { kind: 'heading'; level: number; marker: string; body: string }
  | { kind: 'bullet'; marker: string; body: string }
  | { kind: 'quote'; marker: string; body: string }
  | { kind: 'table-sep'; marker: string; body: string }
  | { kind: 'table-row'; marker: string; body: string }
  | { kind: 'blank'; marker: string; body: string }
  | { kind: 'para'; marker: string; body: string };

/** Identify what kind of markdown line this is. */
export function classifyLine(text: string): ClassifiedLine {
  let m: RegExpMatchArray | null;
  m = text.match(/^(#{1,6})\s+(.*)$/);
  if (m) return { kind: 'heading', level: m[1].length, marker: m[1] + ' ', body: m[2] };
  m = text.match(/^(\s*[-*+]\s+)(.*)$/);
  if (m) return { kind: 'bullet', marker: m[1], body: m[2] };
  m = text.match(/^(>\s?)(.*)$/);
  if (m) return { kind: 'quote', marker: m[1], body: m[2] };
  // Table separator (| --- | :--- | ---: |) — check before table-row
  if (/^\|([ \t]*:?-+:?[ \t]*\|)+\s*$/.test(text)) return { kind: 'table-sep', marker: '', body: text };
  // Table row: starts with | and has at least one more |
  if (/^\|.+\|/.test(text)) return { kind: 'table-row', marker: '', body: text };
  if (text.trim() === '') return { kind: 'blank', marker: '', body: '' };
  return { kind: 'para', marker: '', body: text };
}

export interface LineCtx { currentFolder: string; linkIndex: LinkIndexEntry[] }

/** Render a table row or separator as pipe + cell spans. Pipes use
 * `display: none` in CSS but remain in the DOM so `textContent`
 * matches the original markdown text. */
export function renderTableCells(text: string, ctx: LineCtx): string {
  const parts = text.split('|');
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      if (parts[i]) html += escHtml(parts[i]);
    } else {
      html += '<span class="ml-pipe">|</span>';
      const isTrailingEmpty = i === parts.length - 1 && !parts[i].trim();
      if (!isTrailingEmpty) {
        html += `<span class="ml-tcell">${renderInline(parts[i], { active: false, ...ctx })}</span>`;
      }
    }
  }
  return html;
}

/** Render one classified line to the `{ cls, inner }` pair the
 * editor uses to populate `<div class="ml-line">…</div>`. */
export function lineHtml(text: string, active: boolean, ctx: LineCtx): { cls: string; inner: string } {
  const c = classifyLine(text);
  let cls = 'ml-line';
  let inner = '';

  if (c.kind === 'heading') {
    cls += ` is-h${Math.min(c.level, 3)}`;
    if (active) cls += ' is-active';
    inner = `<span class="ml-marker is-hideable">${escHtml(c.marker)}</span>`
      + renderInline(c.body, { active, ...ctx });
  } else if (c.kind === 'bullet') {
    cls += ' is-bullet';
    if (active) cls += ' is-active';
    inner = `<span class="ml-marker is-hideable">${escHtml(c.marker)}</span>`
      + renderInline(c.body, { active, ...ctx });
  } else if (c.kind === 'quote') {
    cls += ' is-quote';
    if (active) cls += ' is-active';
    inner = `<span class="ml-marker is-hideable">${escHtml(c.marker)}</span>`
      + renderInline(c.body, { active, ...ctx });
  } else if (c.kind === 'table-sep') {
    cls += ' is-table-sep';
    if (active) { cls += ' is-active'; inner = escHtml(text); }
    else inner = renderTableCells(text, ctx);
  } else if (c.kind === 'table-row') {
    cls += ' is-table-row';
    if (active) { cls += ' is-active'; inner = escHtml(text); }
    else inner = renderTableCells(text, ctx);
  } else if (c.kind === 'blank') {
    cls += ' is-blank';
    if (active) cls += ' is-active';
    inner = '<br>';
  } else {
    if (active) cls += ' is-active';
    inner = renderInline(text, { active, ...ctx });
  }
  return { cls, inner };
}
