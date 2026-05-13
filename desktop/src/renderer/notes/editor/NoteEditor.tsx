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
import { imagePaste } from './extensions/image-paste';
import { imageDecorations } from './extensions/image-decorations';
import { dropLink } from './extensions/dropLink';
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

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  onOpenNote: (id: string) => void;
  suggestLinks: (query: string) => Promise<WikiLinkSuggestion[]>;
  isSourceMode?: boolean;
  knownIds?: Set<string>;
  savedInstance?: SavedEditorInstance;
  onSaveInstance?: (instance: SavedEditorInstance) => void;
  folder: string;
  campaignPath: string;
  /** Optional ref that will be populated with the live EditorView on mount. */
  viewRef?: React.MutableRefObject<EditorView | null>;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  content,
  onChange,
  onOpenNote,
  suggestLinks,
  isSourceMode = false,
  knownIds,
  savedInstance,
  onSaveInstance,
  folder,
  campaignPath,
  viewRef,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);

  // Stable refs so effects/callbacks always call the latest version.
  const onChangeRef = useRef(onChange);
  const suggestRef = useRef(suggestLinks);
  const onOpenRef = useRef(onOpenNote);
  const onSaveInstanceRef = useRef(onSaveInstance);
  const isSourceModeRef = useRef(isSourceMode);
  onChangeRef.current = onChange;
  suggestRef.current = suggestLinks;
  onOpenRef.current = onOpenNote;
  onSaveInstanceRef.current = onSaveInstance;
  isSourceModeRef.current = isSourceMode;

  // The compartment is paired with the EditorState it belongs to.
  // When restoring a saved instance the compartment is reused so that
  // reconfigure() dispatches work on the right state.
  const modeCompartmentRef = useRef<Compartment>(
    savedInstance?.modeCompartment ?? new Compartment(),
  );

  /** Extensions that differ between live and source mode. */
  function buildModeExtensions(sourceMode: boolean): Extension[] {
    if (sourceMode) return [];
    return [
      markdownDecorations(),
      imageDecorations(),
      wikiLinks({
        suggest: (q) => suggestRef.current(q),
        onOpen: (id) => onOpenRef.current(id),
      }),
    ];
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
      imagePaste({ folder, campaignPath }),
      dropLink({ campaignPath }),
      Prec.high(formattingKeymap),
      compartment.of(buildModeExtensions(isSourceModeRef.current)),
    ];

    // Restore a previously saved instance (preserves doc, selection, undo history).
    // If the mode changed while this tab was backgrounded, reconfigure immediately.
    const initialState = savedInstance
      ? savedInstance.state
      : EditorState.create({ doc: content, extensions: baseExtensions });

    const view = new EditorView({ state: initialState, parent: editorRef.current });
    internalViewRef.current = view;
    if (viewRef) viewRef.current = view;

    if (savedInstance) {
      // The saved state has the compartment set to whatever mode was active
      // when the tab was last in the foreground. Sync it to the current mode.
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

  // Mode toggle — reconfigures the compartment in-place. No editor recreation,
  // no caret jump, no flash. Re-focus so the caret reappears immediately.
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
    if (view && knownIds && !isSourceMode) {
      view.dispatch({ effects: setKnownIds.of(knownIds) });
    }
  }, [knownIds, isSourceMode]);

  return <div ref={editorRef} className="note-editor-container" />;
};
