import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { makePointerGuard } from './pointer-guard';

export interface MarkdownLinkClickConfig {
  onOpenExternal?: (url: string) => void;
  onOpenInternal?: (rawUrl: string) => void;
}

/** Extract the URL of the markdown link whose range contains `pos`, or null. */
export function urlAtPos(state: EditorState, pos: number): string | null {
  let node: ReturnType<typeof syntaxTree>['topNode'] | null = syntaxTree(state).resolveInner(
    pos,
    1,
  );
  while (node && node.name !== 'Link') node = node.parent;
  if (!node) return null;
  // Reject the inner Link node produced by a wiki-link [[label|id]] — same heuristic as decorations.ts:190
  const charBefore = node.from > 0 ? state.doc.sliceString(node.from - 1, node.from) : '';
  if (charBefore === '[') return null;
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'URL') return state.doc.sliceString(c.from, c.to).trim();
  }
  return null;
}

function defaultOpenExternal(url: string): void {
  window.fsApi.openExternal(url).catch((err) => console.error('openExternal failed', err));
}

export function markdownLinkClick(config: MarkdownLinkClickConfig = {}): Extension {
  const clickHandler = EditorView.domEventHandlers({
    click(event, view) {
      if (event.button !== 0) return false;
      if (!(event.metaKey || event.ctrlKey)) return false;

      const target = event.target as HTMLElement;
      if (!target.closest('.cm-md-link')) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;

      const url = urlAtPos(view.state, pos);
      if (!url) return false;

      event.preventDefault();
      event.stopPropagation();

      if (/^(?:https?|mailto):/i.test(url)) {
        (config.onOpenExternal ?? defaultOpenExternal)(url);
      } else {
        config.onOpenInternal?.(url);
      }
      return true;
    },
  });

  return [makePointerGuard('.cm-md-link'), clickHandler];
}
