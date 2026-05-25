import { useEffect, useRef } from 'react';
import {
  EditorView,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import {
  indentOnInput,
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { lastGaspThemeExtensions } from './theme';
import {
  wikiLinks,
  setKnownIds,
  setEntityLabels,
  type WikiLinkSuggestion,
} from './extensions/wiki-links';
import { markdownLinkClick, type MarkdownLinkClickConfig } from './extensions/markdown-link-click';
import { markdownDecorations } from './extensions/decorations';
import { imagePaste, type ImagePasteConfig } from './extensions/image-paste';
import { imageDecorations, type ImageDecorationsOptions } from './extensions/image-decorations';
import { dropLink, type DropLinkConfig } from './extensions/drop-link';
import { formattingKeymap } from './commands';

/**
 * Pairs an EditorState with the Compartment instance embedded in it.
 * Both must travel together — you cannot reconfigure a compartment that
 * belongs to a different state.
 */
export interface SavedEditorInstance {
  state: EditorState;
  modeCompartment: Compartment;
}

export interface WikiLinksHostConfig {
  suggest?: (query: string) => Promise<WikiLinkSuggestion[]>;
  onOpen?: (id: string) => void;
  knownIds?: Set<string>;
  /** Map of entity id → display label for resolving [[id]] links with no local label. */
  entityLabels?: Map<string, string>;
  onHover?: (id: string, el: HTMLElement) => void;
  onHoverEnd?: (relatedTarget: Element | null) => void;
}

export interface MarkdownEditorProps {
  content: string;
  onChange?: (content: string) => void;

  /** When true, disables all editing and makes onChange optional. */
  readOnly?: boolean;

  isSourceMode?: boolean;

  savedInstance?: SavedEditorInstance;
  onSaveInstance?: (instance: SavedEditorInstance) => void;

  /** Imperative handle for toolbars and focus management. */
  viewRef?: React.MutableRefObject<EditorView | null>;

  /** Enables wiki-link parsing, completion, and click-to-open. Omit to disable. */
  wikiLinks?: WikiLinksHostConfig;

  /** Image decoration options — supply resolveSrc to handle non-notes-asset URLs. */
  images?: ImageDecorationsOptions;

  /** Enables image paste-to-disk. Omit to drop pasted images silently. */
  imagePaste?: ImagePasteConfig;

  /** Enables drag-and-drop link insertion. Omit to disable. */
  dropLink?: DropLinkConfig;

  /** Enables Ctrl/Cmd+click on standard markdown links `[text](url)`. */
  mdLinks?: MarkdownLinkClickConfig;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  isSourceMode = false,
  savedInstance,
  onSaveInstance,
  viewRef,
  wikiLinks: wikiLinksConfig,
  images: imagesConfig,
  imagePaste: imagePasteConfig,
  dropLink: dropLinkConfig,
  mdLinks: mdLinksConfig,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);

  // Stable refs so effects/callbacks always call the latest version.
  const onChangeRef = useRef(onChange);
  const onSaveInstanceRef = useRef(onSaveInstance);
  const isSourceModeRef = useRef(isSourceMode);
  const readOnlyRef = useRef(readOnly);
  const wikiLinksRef = useRef(wikiLinksConfig);
  const imagesRef = useRef(imagesConfig);
  const mdLinksRef = useRef(mdLinksConfig);
  onChangeRef.current = onChange;
  onSaveInstanceRef.current = onSaveInstance;
  isSourceModeRef.current = isSourceMode;
  readOnlyRef.current = readOnly;
  wikiLinksRef.current = wikiLinksConfig;
  imagesRef.current = imagesConfig;
  mdLinksRef.current = mdLinksConfig;

  const modeCompartmentRef = useRef<Compartment>(
    savedInstance?.modeCompartment ?? new Compartment(),
  );

  /** Extensions that differ between live and source mode. */
  function buildModeExtensions(sourceMode: boolean): Extension[] {
    if (sourceMode) return [];
    const exts: Extension[] = [
      markdownDecorations(),
      imageDecorations(imagesRef.current),
      wikiLinks({
        suggest: (q) => wikiLinksRef.current?.suggest(q) ?? Promise.resolve([]),
        onOpen: (id) => wikiLinksRef.current?.onOpen(id),
        onHover: (id, el) => wikiLinksRef.current?.onHover?.(id, el),
        onHoverEnd: (rt) => wikiLinksRef.current?.onHoverEnd?.(rt),
      }),
      markdownLinkClick({
        onOpenExternal: (u) => mdLinksRef.current?.onOpenExternal?.(u),
        onOpenInternal: (u) => mdLinksRef.current?.onOpenInternal?.(u),
      }),
    ];
    return exts;
  }

  // Mount / unmount — runs exactly once per component instance.
  // isSourceMode is intentionally NOT in the dep array; mode changes are
  // handled by the reconfigure effect below without recreating the editor.
  useEffect(() => {
    if (!editorRef.current) return;

    const compartment = modeCompartmentRef.current;

    const ro = readOnlyRef.current;

    const baseExtensions: Extension[] = [
      ...(ro ? [] : [highlightActiveLine()]),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      keymap.of([
        indentWithTab,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...lintKeymap,
      ]),
      markdown({ codeLanguages: languages, base: markdownLanguage }),
      lastGaspThemeExtensions,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
      Prec.high(formattingKeymap),
      compartment.of(buildModeExtensions(isSourceModeRef.current)),
    ];

    if (ro) {
      baseExtensions.push(EditorState.readOnly.of(true));
      baseExtensions.push(EditorView.editable.of(false));
    }

    if (imagePasteConfig) {
      baseExtensions.push(imagePaste(imagePasteConfig));
    }
    if (dropLinkConfig) {
      baseExtensions.push(dropLink(dropLinkConfig));
    }

    // Restore a previously saved instance (preserves doc, selection, undo history).
    const initialState = savedInstance
      ? savedInstance.state
      : EditorState.create({ doc: content, extensions: baseExtensions });

    const view = new EditorView({ state: initialState, parent: editorRef.current });
    internalViewRef.current = view;
    if (viewRef) viewRef.current = view;

    if (savedInstance) {
      // Sync mode in case it changed while this tab was backgrounded.
      view.dispatch({
        effects: compartment.reconfigure(buildModeExtensions(isSourceModeRef.current)),
      });
    }

    return () => {
      onSaveInstanceRef.current?.({ state: view.state, modeCompartment: compartment });
      if (viewRef) viewRef.current = null;
      view.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mode toggle — reconfigures the compartment in-place without editor recreation.
  useEffect(() => {
    const view = internalViewRef.current;
    if (!view) return;
    view.dispatch({
      effects: modeCompartmentRef.current.reconfigure(buildModeExtensions(isSourceMode)),
    });
    view.focus();
  }, [isSourceMode]);

  // External content update (e.g. file reloaded from disk).
  useEffect(() => {
    const view = internalViewRef.current;
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  // Keep wiki-link completions aware of the current known IDs.
  useEffect(() => {
    const view = internalViewRef.current;
    if (view && wikiLinksConfig?.knownIds && !isSourceMode) {
      view.dispatch({ effects: setKnownIds.of(wikiLinksConfig.knownIds) });
    }
  }, [wikiLinksConfig?.knownIds, isSourceMode]);

  // Keep wiki-link decorations aware of the current entity label map.
  useEffect(() => {
    const view = internalViewRef.current;
    if (view && wikiLinksConfig?.entityLabels && !isSourceMode) {
      view.dispatch({ effects: setEntityLabels.of(wikiLinksConfig.entityLabels) });
    }
  }, [wikiLinksConfig?.entityLabels, isSourceMode]);

  return <div ref={editorRef} className="markdown-editor-container" />;
};
