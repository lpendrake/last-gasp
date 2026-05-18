import './peek.css';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { MarkdownPreview } from '../shared/markdown-editor/markdown-preview';
import { parseMd } from './parse-md';

export interface PeekWindowProps {
  path: string;
  anchorRect: DOMRect;
  stackDepth: number;
  /**
   * Async file reader — must resolve to raw markdown content.
   * For not-found files, reject with an Error whose `.code === 'ENOENT'`
   * (or `.name === 'NotFoundError'`) to trigger a silent close instead of
   * showing an error state.
   */
  fetcher: (path: string, signal: AbortSignal) => Promise<string>;
  onPin?: () => void;
  onClose?: () => void;
}

export interface PeekWindowHandle {
  pin(): void;
  close(): void;
  /** The actual `.peek-window` div — use for hit-testing (el.contains(target)). */
  windowEl: HTMLDivElement | null;
}

let zCounter = 400;
function nextZ(): number {
  return ++zCounter;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; title: string; body: string; baseDir: string }
  | { status: 'error'; message: string };

const W = 480;
const G = 12;
const ABSOLUTE_SRC_RE = /^(?:https?:|data:|notes-asset:|file:|\/)/;

export function makeResolveSrc(baseDir: string): (src: string) => string {
  return (src: string) => {
    if (ABSOLUTE_SRC_RE.test(src)) return src;
    // No encoding: slashes in relative paths (e.g. subfolder/pic.png) must be preserved
    return `notes-asset://current/${baseDir}/${src}`;
  };
}

function computeInitialPosition(anchorRect: DOMRect): { left: number; top: number } {
  let left = anchorRect.left;
  const top = anchorRect.bottom + G;
  if (left + W > window.innerWidth - G) left = window.innerWidth - W - G;
  if (left < G) left = G;
  return { left, top };
}

function isNotFound(err: unknown): boolean {
  if (err == null) return false;
  const e = err as Record<string, unknown>;
  return e['code'] === 'ENOENT' || e['name'] === 'NotFoundError';
}

export const PeekWindow = forwardRef<PeekWindowHandle, PeekWindowProps>(function PeekWindow(
  { path, anchorRect, stackDepth: _stackDepth, fetcher, onPin, onClose },
  ref,
) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState(() => computeInitialPosition(anchorRect));
  const [zIndex] = useState(() => nextZ());

  const windowRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (containerRef.current === null) {
    containerRef.current = document.createElement('div');
  }

  // Append/remove portal container
  useEffect(() => {
    const container = containerRef.current!;
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  }, []);

  // Fetch content
  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let cancelled = false;

    fetcher(path, ctrl.signal)
      .then((raw) => {
        if (cancelled || ctrl.signal.aborted) return;
        const parsed = parseMd(path, raw);
        setLoadState({ status: 'loaded', ...parsed });
      })
      .catch((err) => {
        if (cancelled || ctrl.signal.aborted) return;
        if (isNotFound(err)) {
          onClose?.();
          return;
        }
        setLoadState({ status: 'error', message: String(err) });
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [path, fetcher]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bottom-flip via ResizeObserver after content loads
  useLayoutEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight - G) {
        setPosition((p) => ({
          ...p,
          top: Math.max(G, p.top - (r.bottom - window.innerHeight + G)),
        }));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadState.status]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      abortRef.current?.abort();
      onClose?.();
    },
    [onClose],
  );

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPinned) return;
      if ((e.target as Element).closest('.peek-close')) return;
      setIsPinned(true);
      if (windowRef.current) windowRef.current.style.zIndex = String(nextZ());
      onPin?.();
    },
    [isPinned, onPin],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isPinned) return;
      if (!(e.target as Element).closest('.peek-header')) return;
      if ((e.target as Element).closest('.peek-close')) return;
      e.preventDefault();
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = position.left;
      const oy = position.top;
      const onMove = (ev: MouseEvent) => {
        setPosition({ left: ox + ev.clientX - sx, top: oy + ev.clientY - sy });
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
    },
    [isPinned, position.left, position.top],
  );

  useImperativeHandle(
    ref,
    () => ({
      pin() {
        setIsPinned(true);
        if (windowRef.current) windowRef.current.style.zIndex = String(nextZ());
        onPin?.();
      },
      close() {
        abortRef.current?.abort();
        onClose?.();
      },
      get windowEl() {
        return windowRef.current;
      },
    }),
    [onPin, onClose],
  );

  return createPortal(
    <div
      ref={windowRef}
      className={`peek-window${isPinned ? ' is-pinned' : ''}`}
      data-path={path}
      style={{ position: 'fixed', left: position.left, top: position.top, zIndex }}
      onClick={handleBodyClick}
      onMouseDown={handleMouseDown}
    >
      <div className="peek-header">
        {loadState.status === 'loaded' ? (
          <>
            <span className="peek-title">{loadState.title}</span>
            <span className="peek-path-small">{path}</span>
          </>
        ) : (
          <span className="peek-path">{path}</span>
        )}
        <button className="peek-close" aria-label="Close" onClick={handleClose}>
          ×
        </button>
      </div>
      <div className="peek-body">
        {loadState.status === 'loading' && <span className="peek-loading">Loading…</span>}
        {loadState.status === 'error' && (
          <span className="peek-error">Error: {loadState.message}</span>
        )}
        {loadState.status === 'loaded' && (
          <MarkdownPreview
            content={loadState.body}
            images={{ resolveSrc: makeResolveSrc(loadState.baseDir) }}
          />
        )}
      </div>
    </div>,
    containerRef.current,
  );
});
