import { useMemo, type CSSProperties, type ReactElement } from 'react';
import './session-bands.css';
import type { EventListItem, Session } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import {
  computeSessionBandsFromSessions,
  computeSessionPills,
  type SessionPillLayout,
} from './session-bands';

interface SessionBandsProps {
  sessions: Session[];
  events: EventListItem[];
  view: ViewState;
  size: ViewportSize;
  sessionMode?: boolean;
  onPillClick?: (sessionId: string) => void;
}

interface SessionPillProps {
  pill: SessionPillLayout;
  sessionMode?: boolean;
  onPillClick?: (sessionId: string) => void;
}

function SessionPill({ pill, sessionMode, onPillClick }: SessionPillProps): ReactElement {
  const className =
    'session-pill' +
    (pill.leftFlat ? ' left-flat' : '') +
    (pill.rightFlat ? ' right-flat' : '') +
    (sessionMode ? ' session-pill--editable' : '');

  return (
    <div
      className={className}
      data-session-id={pill.sessionId}
      style={
        {
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
          '--pill-color': pill.color,
          pointerEvents: sessionMode ? 'auto' : 'none',
          cursor: sessionMode ? 'pointer' : 'default',
        } as CSSProperties
      }
      onClick={() => {
        if (sessionMode && onPillClick) onPillClick(pill.sessionId);
      }}
    >
      {pill.label !== null && <span className="session-pill-label">{pill.label}</span>}
      {pill.leftFlat && <div className="session-pill-seam" />}
    </div>
  );
}

export function SessionBands({
  sessions,
  events,
  view,
  size,
  sessionMode,
  onPillClick,
}: SessionBandsProps): ReactElement | null {
  const bands = useMemo(
    () => computeSessionBandsFromSessions(sessions, events),
    [sessions, events],
  );

  const pills = useMemo(
    () => computeSessionPills(bands, sessions, view, size),
    [bands, sessions, view, size],
  );

  if (size.width === 0 || size.height === 0) return null;
  if (pills.length === 0) return null;

  return (
    <div
      data-session-layer
      data-session-mode={sessionMode || undefined}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {pills.map((pill) => (
        <SessionPill
          key={pill.sessionId}
          pill={pill}
          sessionMode={sessionMode}
          onPillClick={onPillClick}
        />
      ))}
    </div>
  );
}
