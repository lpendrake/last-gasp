import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

/**
 * Returns a CM6 extension that intercepts Ctrl/Cmd+left-click on elements
 * matching `selector` in the capture phase, preventing the default CM6
 * cursor-placement behaviour while still allowing the subsequent click
 * event to reach the handler that opens the link.
 */
export function makePointerGuard(selector: string): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly onPointerDown = (event: PointerEvent) => {
        if (!(event.metaKey || event.ctrlKey)) return;
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (!target.closest(selector)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      constructor(readonly view: EditorView) {
        view.dom.addEventListener('pointerdown', this.onPointerDown, true);
      }

      destroy() {
        this.view.dom.removeEventListener('pointerdown', this.onPointerDown, true);
      }
    },
  );
}
