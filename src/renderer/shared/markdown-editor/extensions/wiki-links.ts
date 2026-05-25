/*
 * Portions of this code are derived from atomic-editor (MIT) by kenforthewin
 * Adapted for [[Display Text|id]] syntax and 4-character alphanumeric IDs.
 */

import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import {
  Prec,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  type DecorationSet,
} from '@codemirror/view';
import { makePointerGuard } from './pointer-guard';

export type WikiLinkStatus = 'resolved' | 'loading' | 'missing' | 'unresolved';

export interface WikiLinkSuggestion {
  id: string;
  label: string;
  detail?: string;
  boost?: number;
  /** Present for image assets — causes insertion of ![label](notes-asset://...) instead of [[label|id]] */
  assetPath?: string;
}

export interface WikiLinksConfig {
  suggest?: (query: string) => Promise<WikiLinkSuggestion[]>;
  onOpen?: (id: string) => void;
  openOnClick?: boolean;
  onHover?: (id: string, el: HTMLElement) => void;
  onHoverEnd?: (relatedTarget: Element | null) => void;
}

export interface ParsedWikiLink {
  from: number;
  to: number;
  id: string;
  label: string | null;
  labelFrom: number | null;
  labelTo: number | null;
}

// Dispatching this effect updates the broken-link checker without rebuilding the editor.
export const setKnownIds = StateEffect.define<Set<string>>();

const knownIdsField = StateField.define<Set<string>>({
  create: () => new Set<string>(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setKnownIds)) return e.value;
    }
    return value;
  },
});

// Dispatching this effect updates the entity label map used for [[id]] display resolution.
export const setEntityLabels = StateEffect.define<Map<string, string>>();

const entityLabelMapField = StateField.define<Map<string, string>>({
  create: () => new Map<string, string>(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setEntityLabels)) return e.value;
    }
    return value;
  },
});

// Matches [[query or @query at end of line (@ is an alias trigger; [[ still works)
const WIKI_LINK_QUERY_RE = /(?:\[\[|@)[^\]\n|@]*$/;

export interface TriggerMatch {
  prefixLen: number;
  query: string;
}

export function parseTrigger(matchText: string): TriggerMatch {
  const prefixLen = matchText.startsWith('@') ? 1 : 2;
  return { prefixLen, query: matchText.slice(prefixLen) };
}

class WikiLinkWidget extends WidgetType {
  constructor(
    private readonly id: string,
    private readonly label: string,
    private readonly broken: boolean,
  ) {
    super();
  }

  override eq(other: WikiLinkWidget): boolean {
    return this.id === other.id && this.label === other.label && this.broken === other.broken;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = this.broken ? 'cm-note-link cm-note-link-broken' : 'cm-note-link';
    span.dataset.noteId = this.id;
    span.textContent = this.label;
    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

export function wikiLinks(config: WikiLinksConfig = {}): Extension {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, config);
    },
    update(value, transaction) {
      if (
        transaction.docChanged ||
        transaction.selection ||
        transaction.effects.some((e) => e.is(setKnownIds) || e.is(setEntityLabels))
      ) {
        return buildDecorations(transaction.state, config);
      }
      return value.map(transaction.changes);
    },
    provide: (fieldValue) => EditorView.decorations.from(fieldValue),
  });

  return [
    knownIdsField,
    entityLabelMapField,
    field,
    makeWikiLinkPointerGuard(config),
    wikiLinkEditKeymap(config),
    wikiLinkCompletions(config),
    makeWikiLinkClickHandler(config),
  ];
}

function wikiLinkEditKeymap(config: WikiLinksConfig): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: 'Backspace',
        run: (view) => {
          const range = view.state.selection.main;
          if (!range.empty) return false;
          const cursor = range.head;
          const line = view.state.doc.lineAt(cursor);
          const links = findWikiLinksInLine(line.text, line.from);
          const link = links.find((l) => l.to === cursor);
          if (link && !link.label) {
            view.dispatch({
              selection: { anchor: link.from + 2 },
              scrollIntoView: true,
            });
            return true;
          }
          return false;
        },
      },
      {
        key: 'Ctrl-Enter',
        run: (view) => {
          if (!config.onOpen) return false;
          const cursor = view.state.selection.main.head;
          const line = view.state.doc.lineAt(cursor);
          const links = findWikiLinksInLine(line.text, line.from);
          const link = links.find((l) => l.from <= cursor && cursor <= l.to);
          if (!link) return false;
          config.onOpen(link.id);
          return true;
        },
      },
    ]),
  );
}

export interface WikiLinkApplyResult {
  insert: string;
  replaceFrom: number;
  replaceTo: number;
}

export function buildWikiLinkInsert(
  s: WikiLinkSuggestion,
  prefixLen: number,
  from: number,
  to: number,
  nextTwo: string,
): WikiLinkApplyResult {
  const replaceFrom = from - prefixLen;
  if (s.assetPath) {
    return {
      insert: `![${s.label}](notes-asset://current/${s.assetPath})`,
      replaceFrom,
      replaceTo: to,
    };
  }
  return {
    insert: `[[${s.id}]]`,
    replaceFrom,
    replaceTo: nextTwo === ']]' ? to + 2 : to,
  };
}

function wikiLinkCompletions(config: WikiLinksConfig): Extension {
  if (!config.suggest) return [];

  return autocompletion({
    activateOnTyping: true,
    icons: false,
    override: [
      async (context: CompletionContext) => {
        const match = context.matchBefore(WIKI_LINK_QUERY_RE);
        if (!match || (match.from === match.to && !context.explicit)) return null;

        const { prefixLen, query } = parseTrigger(match.text);
        const suggestions = await config.suggest!(query);
        if (context.aborted) return null;

        return {
          from: match.from + prefixLen,
          to: context.pos,
          options: suggestions.map((s) => ({
            label: s.label,
            detail: s.detail,
            apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
              const nextTwo = view.state.doc.sliceString(to, to + 2);
              const { insert, replaceFrom, replaceTo } = buildWikiLinkInsert(
                s,
                prefixLen,
                from,
                to,
                nextTwo,
              );
              view.dispatch({
                changes: { from: replaceFrom, to: replaceTo, insert },
                selection: { anchor: replaceFrom + insert.length },
              });
            },
          })),
          validFor: /^[^\]\n|@]*$/,
        };
      },
    ],
  });
}

function makeWikiLinkClickHandler(config: WikiLinksConfig): Extension {
  return EditorView.domEventHandlers({
    click(event) {
      if (!config.onOpen) return false;
      if (event.button !== 0) return false;
      if (!(event.metaKey || event.ctrlKey)) return false;

      const target = event.target as HTMLElement;
      const link = target.closest<HTMLElement>('.cm-note-link');
      const noteId = link?.dataset.noteId;
      if (!noteId) return false;

      event.preventDefault();
      event.stopPropagation();
      config.onOpen(noteId);
      return true;
    },
  });
}

function makeWikiLinkPointerGuard(config: WikiLinksConfig): Extension {
  return [
    makePointerGuard('.cm-note-link'),
    ViewPlugin.fromClass(
      class {
        private readonly onMouseOver = (event: MouseEvent) => {
          if (!config.onHover) return;
          const link = (event.target as HTMLElement).closest<HTMLElement>('.cm-note-link');
          if (!link) return;
          const noteId = link.dataset.noteId;
          if (!noteId) return;
          config.onHover(noteId, link);
        };

        private readonly onMouseOut = (event: MouseEvent) => {
          if (!config.onHoverEnd) return;
          if (!(event.target as HTMLElement).closest<HTMLElement>('.cm-note-link')) return;
          config.onHoverEnd(event.relatedTarget as Element | null);
        };

        constructor(readonly view: EditorView) {
          view.dom.addEventListener('mouseover', this.onMouseOver);
          view.dom.addEventListener('mouseout', this.onMouseOut);
        }

        destroy() {
          this.view.dom.removeEventListener('mouseover', this.onMouseOver);
          this.view.dom.removeEventListener('mouseout', this.onMouseOut);
        }
      },
    ),
  ];
}

export function buildDecorations(state: EditorState, _config: WikiLinksConfig): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  // knownIds is empty until the first setKnownIds effect; empty = don't mark as broken yet
  const knownIds = state.field(knownIdsField, false) ?? new Set<string>();
  const entityLabelMap = state.field(entityLabelMapField, false) ?? new Map<string, string>();
  const hasIndex = knownIds.size > 0;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const links = findWikiLinksInLine(line.text, line.from);

    for (const link of links) {
      // Inclusive bounds: cursor AT link.from or link.to counts as "inside" the link.
      // This matters because Decoration.replace (used below) is atomic — the cursor
      // can only land at the two boundary positions, never strictly inside.
      const isSelected =
        !state.readOnly &&
        state.selection.ranges.some((r) => r.from <= link.to && r.to >= link.from);
      const broken = hasIndex && !knownIds.has(link.id);

      if (isSelected) {
        builder.add(link.from, link.to, Decoration.mark({ class: 'cm-wiki-link-raw' }));
      } else {
        // Replace the entire [[…]] range with the label widget so the cursor
        // cannot stray inside the hidden syntax (which was the root cause of
        // Ctrl+Enter failing — cursor would land at link.to + 1 and miss the check).
        builder.add(
          link.from,
          link.to,
          Decoration.replace({
            widget: new WikiLinkWidget(
              link.id,
              link.label || entityLabelMap.get(link.id) || link.id,
              broken,
            ),
          }),
        );
      }
    }
  }

  return builder.finish();
}

export function findWikiLinksInLine(text: string, lineStart: number): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const open = text.indexOf('[[', searchFrom);
    if (open === -1) break;

    const close = text.indexOf(']]', open + 2);
    if (close === -1) break;

    const body = text.slice(open + 2, close);
    const pipe = body.indexOf('|');

    const rawLabel = pipe === -1 ? null : body.slice(0, pipe);
    const rawId = pipe === -1 ? body : body.slice(pipe + 1);

    const id = rawId.trim();
    if (!id) {
      searchFrom = close + 2;
      continue;
    }

    links.push({
      from: lineStart + open,
      to: lineStart + close + 2,
      id,
      label: rawLabel ? rawLabel.trim() : null,
      labelFrom: rawLabel ? lineStart + open + 2 : null,
      labelTo: rawLabel ? lineStart + open + 2 + pipe : null,
    });
    searchFrom = close + 2;
  }

  return links;
}
