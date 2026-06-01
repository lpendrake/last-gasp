import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { isCursorNear, buildDecorations } from '../decorations';

describe('isCursorNear', () => {
  // Element spans positions 5–10 (exclusive end)
  const from = 5;
  const to = 10;

  it('returns true when cursor is inside the element', () => {
    expect(isCursorNear(5, from, to)).toBe(true); // at start
    expect(isCursorNear(7, from, to)).toBe(true); // middle
    expect(isCursorNear(9, from, to)).toBe(true); // at last char
  });

  it('returns true when cursor is at the exclusive end (adjacent after)', () => {
    expect(isCursorNear(10, from, to)).toBe(true);
  });

  it('returns false when cursor is one position before the element', () => {
    // Being at the \n character before an element must NOT reveal its markers.
    expect(isCursorNear(4, from, to)).toBe(false);
  });

  it('returns false when cursor is two or more positions before', () => {
    expect(isCursorNear(3, from, to)).toBe(false);
    expect(isCursorNear(0, from, to)).toBe(false);
  });

  it('returns false when cursor is past the end', () => {
    expect(isCursorNear(11, from, to)).toBe(false);
    expect(isCursorNear(20, from, to)).toBe(false);
  });

  it('handles element at document start (from === 0)', () => {
    expect(isCursorNear(0, 0, 3)).toBe(true);
    expect(isCursorNear(3, 0, 3)).toBe(true);
    expect(isCursorNear(4, 0, 3)).toBe(false);
  });
});

describe('heading line-class decorations', () => {
  // Heading lines get both a Decoration.mark (cm-heading-N) spanning the full heading
  // text AND a Decoration.line (cm-heading-line-N) on the line start. The line-class
  // is what allows CSS to target wiki-link replacement widgets inside the heading,
  // because Decoration.replace widgets are DOM siblings of mark spans — not children —
  // so they cannot inherit font-size from the mark alone.
  function makeState(doc: string) {
    return EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
      selection: { anchor: 0 },
    });
  }

  function collectDecoClasses(state: EditorState): string[] {
    const decos = buildDecorations(state);
    const classes: string[] = [];
    decos.between(0, state.doc.length, (_from, _to, deco) => {
      const spec = deco.spec as Record<string, unknown>;
      if (typeof spec['class'] === 'string') classes.push(spec['class'] as string);
    });
    return classes;
  }

  it('adds cm-heading-line-1 class for an h1 line', () => {
    const state = makeState('# Ancient Research Points [[abc1]]');
    const classes = collectDecoClasses(state);
    expect(classes).toContain('cm-heading-line-1');
  });

  it('adds cm-heading-line-2 class for an h2 line', () => {
    const state = makeState('## Sub-section [[abc1]]');
    const classes = collectDecoClasses(state);
    expect(classes).toContain('cm-heading-line-2');
  });

  it('adds cm-heading-line-3 class for an h3 line', () => {
    const state = makeState('### Detail [[abc1]]');
    const classes = collectDecoClasses(state);
    expect(classes).toContain('cm-heading-line-3');
  });

  it('does NOT add a heading-line class for a plain body line', () => {
    const state = makeState('A plain line with [[abc1]]');
    const classes = collectDecoClasses(state);
    expect(classes.some((c) => c.startsWith('cm-heading-line-'))).toBe(false);
  });

  it('adds both cm-heading-1 mark and cm-heading-line-1 line-class for h1', () => {
    const state = makeState('# Title');
    const classes = collectDecoClasses(state);
    expect(classes).toContain('cm-heading-1');
    expect(classes).toContain('cm-heading-line-1');
  });
});

describe('readonly mode: syntax marks always hidden', () => {
  function makeState(doc: string, cursorPos: number, readOnly: boolean) {
    return EditorState.create({
      doc,
      extensions: [
        markdown({ base: markdownLanguage }),
        ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      ],
      selection: { anchor: cursorPos },
    });
  }

  it('in editable mode, HeaderMark is revealed when cursor is inside the heading', () => {
    // "# Heading" — HeaderMark is `#` at pos 0; cursor at pos 2 (inside heading)
    const state = makeState('# Heading', 2, false);
    const decos = buildDecorations(state);
    // When cursor is near, HeaderMark should NOT have a replace decoration
    let headerMarkHidden = false;
    decos.between(0, 1, (_from, _to, deco) => {
      if (
        (deco.spec as Record<string, unknown>)['widget'] === undefined &&
        Object.keys(deco.spec as Record<string, unknown>).length === 0
      ) {
        headerMarkHidden = true;
      }
    });
    // In editable mode with cursor near, no replace decoration on the # mark
    expect(headerMarkHidden).toBe(false);
  });

  it('in readonly mode, HeaderMark is always hidden regardless of cursor position', () => {
    // cursor at pos 2 — inside "# Heading"; in editable mode this would reveal the #
    const state = makeState('# Heading', 2, true);
    expect(state.readOnly).toBe(true);
    const decos = buildDecorations(state);
    // In readonly mode, the # mark must be replaced (hidden) at pos 0
    let headerMarkIsReplaced = false;
    decos.between(0, 2, (_from, _to, deco) => {
      // A replace decoration has empty spec (no class, no widget — it just replaces)
      const spec = deco.spec as Record<string, unknown>;
      if (spec['widget'] === undefined && spec['class'] === undefined) {
        headerMarkIsReplaced = true;
      }
    });
    expect(headerMarkIsReplaced).toBe(true);
  });
});
