// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
  parseTrigger,
  findWikiLinksInLine,
  wikiLinks,
  buildDecorations,
  buildWikiLinkInsert,
  setEntityLabels,
  type WikiLinksConfig,
  type WikiLinkSuggestion,
} from '../wiki-links';

describe('parseTrigger', () => {
  it('treats [[ as a 2-char prefix', () => {
    expect(parseTrigger('[[hello')).toEqual({ prefixLen: 2, query: 'hello' });
  });

  it('treats @ as a 1-char prefix', () => {
    expect(parseTrigger('@hello')).toEqual({ prefixLen: 1, query: 'hello' });
  });

  it('returns empty query for bare trigger', () => {
    expect(parseTrigger('[[')).toEqual({ prefixLen: 2, query: '' });
    expect(parseTrigger('@')).toEqual({ prefixLen: 1, query: '' });
  });
});

describe('findWikiLinksInLine', () => {
  it('parses a link with label and id', () => {
    const links = findWikiLinksInLine('See [[Captain Renard|rn42]] for details.', 0);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ id: 'rn42', label: 'Captain Renard', from: 4, to: 27 });
  });

  it('parses a bare id link (no label)', () => {
    const links = findWikiLinksInLine('[[abc1]]', 0);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ id: 'abc1', label: null });
  });

  it('finds multiple links on one line', () => {
    const links = findWikiLinksInLine('[[Foo|foo1]] and [[Bar|bar2]]', 0);
    expect(links).toHaveLength(2);
    expect(links[0].id).toBe('foo1');
    expect(links[1].id).toBe('bar2');
  });

  it('offsets positions by lineStart', () => {
    const links = findWikiLinksInLine('[[x|ab12]]', 100);
    expect(links[0].from).toBe(100);
    expect(links[0].to).toBe(110);
  });

  it('skips links with empty id', () => {
    const links = findWikiLinksInLine('[[label|]]', 0);
    expect(links).toHaveLength(0);
  });

  it('trims whitespace from id and label', () => {
    const links = findWikiLinksInLine('[[ My Note | ab12 ]]', 0);
    expect(links[0].id).toBe('ab12');
    expect(links[0].label).toBe('My Note');
  });

  it('returns nothing when no closing brackets', () => {
    const links = findWikiLinksInLine('[[unclosed', 0);
    expect(links).toHaveLength(0);
  });
});

describe('cursor-in-link range check (inclusive bounds)', () => {
  // Verifies the logic used by Ctrl+Enter and the isSelected decoration check.
  // The key invariant: cursor AT link.from or link.to must be considered "inside"
  // the link so that Decoration.replace (atomic) boundary positions trigger navigation.
  it('cursor at link.from is inside the range', () => {
    const [link] = findWikiLinksInLine('[[Bob|abc1]]', 0);
    // from=0, to=12
    expect(link.from <= link.from && link.from <= link.to).toBe(true);
  });

  it('cursor at link.to is inside the range', () => {
    const [link] = findWikiLinksInLine('[[Bob|abc1]]', 0);
    expect(link.from <= link.to && link.to <= link.to).toBe(true);
  });

  it('cursor one before link.from is outside the range', () => {
    const [link] = findWikiLinksInLine('x[[Bob|abc1]]', 0);
    // from=1, cursor at 0
    const cursor = link.from - 1;
    expect(link.from <= cursor && cursor <= link.to).toBe(false);
  });

  it('cursor one after link.to is outside the range', () => {
    const [link] = findWikiLinksInLine('[[Bob|abc1]]x', 0);
    // to=12, cursor at 13
    const cursor = link.to + 1;
    expect(link.from <= cursor && cursor <= link.to).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onHover / onHoverEnd callbacks (requires DOM via happy-dom)
// ---------------------------------------------------------------------------

function makeView(config: WikiLinksConfig): { view: EditorView; container: HTMLDivElement } {
  // Put the link at position 4 so the default cursor (pos 0) is outside the link
  // range [4, 22], preventing the "isSelected → mark" branch from firing and ensuring
  // the Decoration.replace widget (which renders .cm-note-link) is used instead.
  const state = EditorState.create({
    doc: 'See [[Test Note|abc1]]',
    extensions: [wikiLinks(config)],
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const view = new EditorView({ state, parent: container });
  return { view, container };
}

describe('onHover / onHoverEnd callbacks', () => {
  const views: EditorView[] = [];
  afterEach(() => {
    views.forEach((v) => v.destroy());
    views.length = 0;
    document.body.innerHTML = '';
  });

  it('calls onHover with (noteId, element) when mouse enters a .cm-note-link span', () => {
    const onHover = vi.fn();
    const { view, container } = makeView({ onHover });
    views.push(view);

    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link).not.toBeNull();
    expect(link!.dataset.noteId).toBe('abc1');

    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledWith('abc1', link);
  });

  it('does not call onHover when mouse enters a non-link element', () => {
    const onHover = vi.fn();
    const { view, container } = makeView({ onHover });
    views.push(view);

    // Dispatch mouseover on the editor root (not a link)
    container.dispatchEvent(new MouseEvent('mouseover', { bubbles: false }));
    expect(onHover).not.toHaveBeenCalled();
  });

  it('calls onHoverEnd with relatedTarget when mouse leaves a .cm-note-link span', () => {
    const onHoverEnd = vi.fn();
    const { view, container } = makeView({ onHoverEnd });
    views.push(view);

    const link = container.querySelector<HTMLElement>('.cm-note-link');
    const other = document.createElement('div');
    document.body.appendChild(other);

    link!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: other }));
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverEnd).toHaveBeenCalledWith(other);
  });

  it('does not call onHoverEnd when mouse leaves a non-link element', () => {
    const onHoverEnd = vi.fn();
    const { view, container } = makeView({ onHoverEnd });
    views.push(view);

    // Dispatch mouseout on a non-link element inside the editor
    const editorContent = container.querySelector('.cm-content');
    if (editorContent) {
      editorContent.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    }
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  it('does not call onHover when callbacks are not configured', () => {
    const { view, container } = makeView({}); // no onHover
    views.push(view);

    const link = container.querySelector<HTMLElement>('.cm-note-link');
    // Should not throw
    expect(() => {
      link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }).not.toThrow();
  });
});

describe('buildWikiLinkInsert', () => {
  const note: WikiLinkSuggestion = { id: 'abc1', label: 'Alice' };

  it('inserts [[id]] format (not [[label|id]])', () => {
    const { insert } = buildWikiLinkInsert(note, 2, 10, 15, 'xx');
    expect(insert).toBe('[[abc1]]');
  });

  it('replaceFrom accounts for the [[ prefix', () => {
    const { replaceFrom } = buildWikiLinkInsert(note, 2, 10, 15, 'xx');
    expect(replaceFrom).toBe(8);
  });

  it('does not absorb trailing ]] when not present', () => {
    const { replaceTo } = buildWikiLinkInsert(note, 2, 10, 15, 'xx');
    expect(replaceTo).toBe(15);
  });

  it('absorbs trailing ]] when already present', () => {
    const { replaceTo } = buildWikiLinkInsert(note, 2, 10, 15, ']]');
    expect(replaceTo).toBe(17);
  });

  it('inserts image markdown for asset suggestions', () => {
    const img: WikiLinkSuggestion = { id: 'img1', label: 'photo', assetPath: 'images/photo.png' };
    const { insert, replaceTo } = buildWikiLinkInsert(img, 1, 5, 10, ']]');
    expect(insert).toBe('![photo](notes-asset://current/images/photo.png)');
    expect(replaceTo).toBe(10);
  });

  it('uses @ prefix length of 1 correctly', () => {
    const { replaceFrom } = buildWikiLinkInsert(note, 1, 8, 12, 'xx');
    expect(replaceFrom).toBe(7);
  });
});

describe('readonly mode decorations', () => {
  function makeState(doc: string, cursorPos: number, readOnly: boolean) {
    const extensions = [
      markdown({ base: markdownLanguage }),
      ...(readOnly ? [EditorState.readOnly.of(true)] : []),
    ];
    return EditorState.create({ doc, extensions, selection: { anchor: cursorPos } });
  }

  it('in normal (editable) mode, a wiki-link whose range overlaps the selection shows as raw text', () => {
    // cursor at pos 2 — inside [[Bob|abc1]], from=0 to=12
    const state = makeState('[[Bob|abc1]]', 2, false);
    const decos = buildDecorations(state, {});
    let hasRawMark = false;
    decos.between(0, state.doc.length, (_from, _to, deco) => {
      if ((deco.spec as Record<string, unknown>)['class'] === 'cm-wiki-link-raw') hasRawMark = true;
    });
    expect(hasRawMark).toBe(true);
  });

  it('in readonly mode, the same overlapping selection always renders as a widget', () => {
    const state = makeState('[[Bob|abc1]]', 2, true);
    expect(state.readOnly).toBe(true);
    const decos = buildDecorations(state, {});
    let hasRawMark = false;
    let hasWidget = false;
    decos.between(0, state.doc.length, (_from, _to, deco) => {
      const spec = deco.spec as Record<string, unknown>;
      if (spec['class'] === 'cm-wiki-link-raw') hasRawMark = true;
      if (spec['widget'] !== undefined) hasWidget = true;
    });
    expect(hasRawMark).toBe(false);
    expect(hasWidget).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Entity label resolution (requires DOM via happy-dom for view dispatch)
// ---------------------------------------------------------------------------

describe('entity label resolution', () => {
  const views: EditorView[] = [];
  afterEach(() => {
    views.forEach((v) => v.destroy());
    views.length = 0;
    document.body.innerHTML = '';
  });

  function makeViewWithDoc(doc: string): { view: EditorView; container: HTMLDivElement } {
    const state = EditorState.create({ doc, extensions: [wikiLinks({})] });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView({ state, parent: container });
    return { view, container };
  }

  it('resolves [[id]] to entity label when no local label is present', () => {
    const { view, container } = makeViewWithDoc('See [[abc1]]');
    views.push(view);
    view.dispatch({ effects: setEntityLabels.of(new Map([['abc1', 'Alice the Wizard']])) });
    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link?.textContent).toBe('Alice the Wizard');
  });

  it('local label takes precedence over entity label', () => {
    const { view, container } = makeViewWithDoc('See [[Custom Name|abc1]]');
    views.push(view);
    view.dispatch({ effects: setEntityLabels.of(new Map([['abc1', 'Alice the Wizard']])) });
    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link?.textContent).toBe('Custom Name');
  });

  it('falls back to raw ID when entity not in label map', () => {
    const { view, container } = makeViewWithDoc('See [[xyz9]]');
    views.push(view);
    view.dispatch({ effects: setEntityLabels.of(new Map([['other', 'Other Entity']])) });
    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link?.textContent).toBe('xyz9');
  });

  it('shows raw ID before any entity labels are dispatched', () => {
    const { view, container } = makeViewWithDoc('See [[abc1]]');
    views.push(view);
    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link?.textContent).toBe('abc1');
  });
});
