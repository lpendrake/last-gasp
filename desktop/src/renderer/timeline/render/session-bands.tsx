import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import './session-bands.css';
import type { EventListItem, Session } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import {
  computeSessionBandsFromSessions,
  computeSessionPills,
  computeTooltipPosition,
  formatRealRange,
  formatGameRange,
  type SessionPillLayout,
  type TooltipPosition,
} from './session-bands';

interface SessionBandsProps {
  sessions: Session[];
  events: EventListItem[];
  view: ViewState;
  size: ViewportSize;
}

interface TooltipState extends TooltipPosition {
  session: Session;
}

interface SessionTooltipProps extends TooltipPosition {
  session: Session;
}

function SessionTooltip({ session, left, bottom }: SessionTooltipProps): ReactElement {
  return (
    <div
      className="session-tooltip"
      style={{ left, bottom, '--tooltip-border': session.color } as CSSProperties}
    >
      <div className="session-tooltip-header">
        session · <span style={{ color: session.color }}>■</span> {session.id}
      </div>
      <div className="session-tooltip-row">
        <span className="session-tooltip-key">real:</span>
        {formatRealRange(session.realStart, session.realEnd)}
      </div>
      <div className="session-tooltip-row">
        <span className="session-tooltip-key">game:</span>
        {formatGameRange(session.inGameStart, session.inGameEnd)}
      </div>
    </div>
  );
}

interface SessionPillProps {
  pill: SessionPillLayout;
  session: Session;
  onHover: (state: TooltipState | null) => void;
}

function SessionPill({ pill, session, onHover }: SessionPillProps): ReactElement {
  const className =
    'session-pill' + (pill.leftFlat ? ' left-flat' : '') + (pill.rightFlat ? ' right-flat' : '');

  return (
    <div
      className={className}
      style={
        {
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
          '--pill-color': pill.color,
          pointerEvents: 'auto',
        } as CSSProperties
      }
      onMouseEnter={(e) => {
        const pos = computeTooltipPosition(
          e.currentTarget.getBoundingClientRect(),
          window.innerWidth,
          window.innerHeight,
        );
        onHover({ session, ...pos });
      }}
      onMouseLeave={() => onHover(null)}
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
}: SessionBandsProps): ReactElement | null {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const sessionMap = useMemo(
    () => new Map<string, Session>(sessions.map((s) => [s.id, s])),
    [sessions],
  );

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
    <>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {pills.map((pill) => {
          const session = sessionMap.get(pill.sessionId);
          if (!session) return null;
          return (
            <SessionPill key={pill.sessionId} pill={pill} session={session} onHover={setTooltip} />
          );
        })}
      </div>
      {tooltip !== null &&
        createPortal(
          <SessionTooltip session={tooltip.session} left={tooltip.left} bottom={tooltip.bottom} />,
          document.body,
        )}
    </>
  );
}
