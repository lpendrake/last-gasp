import { useMemo, type CSSProperties, type ReactElement } from 'react';
import './cards.css';
import type { EventListItem, Palette } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import { formatCardFace } from '../calendar/format';
import {
  layoutCards,
  assignRows,
  weekdayColorFromPalette,
  CARD_HEIGHT,
  CARD_GAP,
  type LaidOutCard,
  type CardPlacement,
} from './cards';

interface CardsProps {
  events: EventListItem[];
  view: ViewState;
  size: ViewportSize;
  palette: Palette;
  inGameNowSeconds: number;
}

export function Cards({
  events,
  view,
  size,
  palette,
  inGameNowSeconds,
}: CardsProps): ReactElement | null {
  const laidOut = useMemo(
    () => layoutCards(events, view, size, inGameNowSeconds),
    [events, view, size, inGameNowSeconds],
  );

  const placed = useMemo((): (LaidOutCard & CardPlacement)[] => {
    const placements = assignRows(laidOut);
    return laidOut.map((card) => ({ ...card, ...placements.get(card.event.filename)! }));
  }, [laidOut]);

  if (size.width === 0 || size.height === 0) return null;

  const axisY = Math.floor(size.height * 0.8);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Connectors first so cards render on top */}
      {placed.map((card) => (
        <div
          key={`conn-${card.event.filename}`}
          className="event-card-connector"
          style={{
            left: card.x,
            top: axisY - CARD_GAP - card.row * (CARD_HEIGHT + CARD_GAP),
            height: CARD_GAP + card.row * (CARD_HEIGHT + CARD_GAP),
          }}
        />
      ))}
      {placed.map((card) => (
        <div
          key={`dot-${card.event.filename}`}
          className="event-card-dot"
          style={{ left: card.x, top: axisY }}
        />
      ))}
      {placed.map((card) => {
        const cardTop = axisY - CARD_HEIGHT - CARD_GAP - card.row * (CARD_HEIGHT + CARD_GAP);
        const color = card.event.color ?? weekdayColorFromPalette(card.parsedDate, palette);
        return (
          <div
            key={card.event.filename}
            className={`event-card${card.isFuture ? ' is-future' : ''}`}
            style={
              {
                left: card.x - card.width / 2,
                width: card.width,
                top: cardTop,
                '--weekday-color': color,
              } as CSSProperties
            }
          >
            <div className="event-card-header" />
            <div className="event-card-body">
              <div className="event-card-title">{card.event.title}</div>
              <div className="event-card-date">{formatCardFace(card.parsedDate)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
