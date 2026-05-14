import React, { useEffect, useRef } from 'react';
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
import { wikiLinks, setKnownIds, type WikiLinkSuggestion } from './extensions/wiki-links';
import { markdownDecorations } from './extensions/decorations';
import { imagePaste, type ImagePasteConfig } from './extensions/image-paste';
import { imageDecorations } from './extensions/image-decorations';
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
  suggest: (query: string) => Promise<WikiLinkSuggestion[]>;
  onOpen: (id: string) => void;
  knownIds?: Set<string>;
}

export interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;

  isSourceMode?: boolean;

  savedInstance?: SavedEditorInstance;
  onSaveInstance?: (instance: SavedEditorInstance) => void;

  /** Imperative handle for toolbars and focus management. */
  viewRef?: React.MutableRefObject<EditorView | null>;

  /** Enables wiki-link parsing, completion, and click-to-open. Omit to disable. */
  wikiLinks?: WikiLinksHostConfig;

  /** Enables image paste-to-disk. Omit to drop pasted images silently. */
  imagePaste?: ImagePasteConfig;

  /** Enables drag-and-drop link insertion. Omit to disable. */
  dropLink?: DropLinkConfig;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  isSourceMode = false,
  savedInstance,
  onSaveInstance,
  viewRef,
  wikiLinks: wikiLinksConfig,
  imagePaste: imagePasteConfig,
  dropLink: dropLinkConfig,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);

  // Stable refs so effects/callbacks always call the latest version.
  const onChangeRef = useRef(onChange);
  const onSaveInstanceRef = useRef(onSaveInstance);
  const isSourceModeRef = useRef(isSourceMode);
  const wikiLinksRef = useRef(wikiLinksConfig);
  onChangeRef.current = onChange;
  onSaveInstanceRef.current = onSaveInstance;
  isSourceModeRef.current = isSourceMode;
  wikiLinksRef.current = wikiLinksConfig;

  const modeCompartmentRef = useRef<Compartment>(
    savedInstance?.modeCompartment ?? new Compartment(),
  );

  /** Extensions that differ between live and source mode. */
  function buildModeExtensions(sourceMode: boolean): Extension[] {
    if (sourceMode) return [];
    const exts: Extension[] = [markdownDecorations(), imageDecorations()];
    if (wikiLinksRef.current) {
      exts.push(
        wikiLinks({
          suggest: (q) => wikiLinksRef.current!.suggest(q),
          onOpen: (id) => wikiLinksRef.current!.onOpen(id),
        }),
      );
    }
    return exts;
  }

  // Mount / unmount — runs exactly once per component instance.
  // isSourceMode is intentionally NOT in the dep array; mode changes are
  // handled by the reconfigure effect below without recreating the editor.
  useEffect(() => {
    if (!editorRef.current) return;

    const compartment = modeCompartmentRef.current;

    const baseExtensions: Extension[] = [
      highlightActiveLine(),
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
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      Prec.high(formattingKeymap),
      compartment.of(buildModeExtensions(isSourceModeRef.current)),
    ];

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

  return <div ref={editorRef} className="markdown-editor-container" />;
};
