import { useRef, useCallback, type CSSProperties, type ReactElement } from 'react';
import { MarkdownPreview } from '../../shared/markdown-editor';
import type { PreviewSize } from '../interactions/usePreviewSize';

const ABSOLUTE_SRC_RE = /^(?:https?:|data:|notes-asset:|file:|\/)/;

function resolveEventImageSrc(src: string): string {
  if (ABSOLUTE_SRC_RE.test(src)) return src;
  return `notes-asset://current/events/${encodeURIComponent(src)}`;
}

interface CardExpansionProps {
  body: string | null;
  expandsDown: boolean;
  size: PreviewSize;
  centerX: number;
  onSizeChange: (s: PreviewSize) => void;
  /** Called with a boolean indicating whether a resize drag is in progress */
  onResizeDragChange: (active: boolean) => void;
  onOpenById?: (id: string) => void;
}

export function CardExpansion({
  body,
  expandsDown,
  size,
  centerX,
  onSizeChange,
  onResizeDragChange,
  onOpenById,
}: CardExpansionProps): ReactElement {
  // Ref to the expansion container element (owns the height we resize)
  const expRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback(
    (dir: 'nw' | 'ne' | 'sw' | 'se') => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const expEl = expRef.current;
      if (!expEl) return;
      // Walk up to the card element (direct parent)
      const cardEl = expEl.parentElement as HTMLElement | null;
      if (!cardEl) return;

      onResizeDragChange(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = cardEl.offsetWidth;
      const startH = expEl.offsetHeight;
      const startTop = parseFloat(cardEl.style.top);

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        // Symmetric width resize around the timeline anchor point (centerX)
        const isWest = dir === 'nw' || dir === 'sw';
        const newW = Math.max(200, startW + (isWest ? -dx : dx) * 2);
        cardEl.style.width = `${newW}px`;
        cardEl.style.left = `${centerX - newW / 2}px`;

        if (expandsDown) {
          const newH = Math.max(100, startH + dy);
          expEl.style.height = `${newH}px`;
        } else {
          const newH = Math.max(100, startH - dy);
          const newTop = startTop + (startH - newH);
          if (newTop < 0) {
            expEl.style.height = `${Math.max(100, startH + startTop)}px`;
            cardEl.style.top = '0px';
          } else {
            expEl.style.height = `${newH}px`;
            cardEl.style.top = `${newTop}px`;
          }
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        onResizeDragChange(false);
        onSizeChange({
          width: cardEl.offsetWidth,
          expandedHeight: expRef.current?.offsetHeight ?? size.expandedHeight,
        });

        // The mouseup fires just before a click event; block that click so it
        // doesn't collapse the expansion immediately after a resize.
        document.addEventListener('click', (ev) => ev.stopPropagation(), {
          capture: true,
          once: true,
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [centerX, expandsDown, onResizeDragChange, onSizeChange, size.expandedHeight],
  );

  const dirs = expandsDown ? (['sw', 'se'] as const) : (['nw', 'ne'] as const);

  return (
    <div
      ref={expRef}
      className={`event-card-expanded${expandsDown ? ' expands-down' : ''}`}
      style={{ height: size.expandedHeight } as CSSProperties}
    >
      {body !== null ? (
        <MarkdownPreview
          className="exp-body"
          content={body}
          images={{ resolveSrc: resolveEventImageSrc }}
          baseDir="events"
          wikiLinks={onOpenById ? { onOpen: onOpenById } : undefined}
        />
      ) : (
        <div className="exp-body">
          <span className="exp-loading">Loading…</span>
        </div>
      )}
      {dirs.map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-handle-${dir}`}
          onMouseDown={handleResizeMouseDown(dir)}
        />
      ))}
    </div>
  );
}
