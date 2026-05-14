import { useMemo, type CSSProperties, type ReactElement } from 'react';
import './cards.css';
import type { EventListItem, Palette } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import { parseISOString } from '../calendar/golarian';
import { formatCardFace } from '../calendar/format';
import { paletteToCssVars } from '../palette';
import { layoutCards, assignRows, weekdayColorFromPalette, CARD_HEIGHT, CARD_GAP } from './cards';

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

  const placements = useMemo(() => assignRows(laidOut), [laidOut]);

  if (size.width === 0 || size.height === 0) return null;

  const axisY = Math.floor(size.height * 0.8);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...paletteToCssVars(palette),
      }}
    >
      {/* Connectors first so cards render on top */}
      {laidOut.map((card) => {
        const { row } = placements.get(card.event.filename)!;
        return (
          <div
            key={`conn-${card.event.filename}`}
            className="event-card-connector"
            style={{
              left: card.x,
              top: axisY - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP),
              height: CARD_GAP + row * (CARD_HEIGHT + CARD_GAP),
            }}
          />
        );
      })}
      {laidOut.map((card) => (
        <div
          key={`dot-${card.event.filename}`}
          className="event-card-dot"
          style={{ left: card.x, top: axisY }}
        />
      ))}
      {laidOut.map((card) => {
        const { row, width } = placements.get(card.event.filename)!;
        const cardTop = axisY - CARD_HEIGHT - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP);
        const color = card.event.color ?? weekdayColorFromPalette(card.event.date, palette);
        return (
          <div
            key={card.event.filename}
            className={`event-card${card.isFuture ? ' is-future' : ''}`}
            data-filename={card.event.filename}
            style={
              {
                left: card.x - width / 2,
                width,
                top: cardTop,
                '--weekday-color': color,
              } as CSSProperties
            }
          >
            <div className="event-card-header" />
            <div className="event-card-body">
              <div className="event-card-title">{card.event.title}</div>
              <div className="event-card-date">
                {formatCardFace(parseISOString(card.event.date))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
