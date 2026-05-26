import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PeekWindow } from './peek-window';
import type { PeekWindowHandle } from './peek-window';

export interface PeekHandle {
  pin(): void;
  close(): void;
  updateLabels(labels: Map<string, string>): void;
  /**
   * The `.peek-window` div — use for hit-testing (`el.contains(target)`).
   * Lazily resolved: the element is available after the first React render.
   */
  readonly el: HTMLDivElement;
  path: string;
}

export interface ShowPeekOptions {
  targetEl: HTMLElement;
  linkInfo: { path: string };
  fetcher: (path: string, signal: AbortSignal) => Promise<string>;
  onOpenById?: (id: string) => void;
  entityLabels?: Map<string, string>;
  stackDepth?: number;
  onPin?: () => void;
  onClose?: () => void;
}

export function showPeek(opts: ShowPeekOptions): PeekHandle {
  const { targetEl, linkInfo, fetcher, onOpenById, stackDepth = 0, onPin, onClose } = opts;

  let currentEntityLabels = opts.entityLabels;

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const windowRef = createRef<PeekWindowHandle>();

  const anchorRect = targetEl.getBoundingClientRect();

  function destroy() {
    queueMicrotask(() => {
      root.unmount();
      host.remove();
    });
  }

  function renderWindow() {
    root.render(
      createElement(PeekWindow, {
        ref: windowRef,
        path: linkInfo.path,
        anchorRect,
        stackDepth,
        fetcher,
        onOpenById,
        entityLabels: currentEntityLabels,
        onPin,
        onClose: () => {
          onClose?.();
          destroy();
        },
      }),
    );
  }

  renderWindow();

  return {
    pin() {
      windowRef.current?.pin();
    },
    close() {
      windowRef.current?.close();
      destroy();
    },
    updateLabels(labels: Map<string, string>) {
      currentEntityLabels = labels;
      renderWindow();
    },
    // Getter: resolves after first React render when windowRef is populated.
    // Falls back to the React root host before first paint (unlikely in practice).
    get el(): HTMLDivElement {
      return (windowRef.current?.windowEl ?? host) as HTMLDivElement;
    },
    path: linkInfo.path,
  };
}
