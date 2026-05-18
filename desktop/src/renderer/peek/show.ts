import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PeekWindow } from './peek-window';
import type { PeekWindowHandle } from './peek-window';
import type { PeekKind } from './resolve';

export interface PeekHandle {
  pin(): void;
  close(): void;
  el: HTMLDivElement;
  path: string;
}

export interface ShowPeekOptions {
  targetEl: HTMLElement;
  linkInfo: { kind: PeekKind; path: string };
  fetcher: (path: string, signal: AbortSignal) => Promise<string>;
  stackDepth?: number;
  onPin?: () => void;
  onClose?: () => void;
}

export function showPeek(opts: ShowPeekOptions): PeekHandle {
  const { targetEl, linkInfo, fetcher, stackDepth = 0, onPin, onClose } = opts;

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

  root.render(
    createElement(PeekWindow, {
      ref: windowRef,
      path: linkInfo.path,
      kind: linkInfo.kind,
      anchorRect,
      stackDepth,
      fetcher,
      onPin,
      onClose: () => {
        onClose?.();
        destroy();
      },
    }),
  );

  return {
    pin() {
      windowRef.current?.pin();
    },
    close() {
      windowRef.current?.close();
      destroy();
    },
    el: host,
    path: linkInfo.path,
  };
}
