import { useCallback, useMemo, type CSSProperties, type ReactElement } from 'react';
import './cards.css';
import type { EventListItem } from '../data/types';
import type { WeekdayColors } from '../../theme';
import { resolveEntityTagLabel, isValidCustomTag } from '../../../shared/entity-tags';
import type { ViewState, ViewportSize } from '../math/zoom';
import { formatCardFace } from '../calendar/format';
import {
  layoutCards,
  assignRows,
  weekdayColor,
  computeExpansionLayout,
  CARD_HEIGHT,
  CARD_GAP,
  type LaidOutCard,
  type CardPlacement,
} from './cards';
import type { CardExpansionState } from '../interactions/useCardExpansion';
import type { PreviewSize } from '../interactions/usePreviewSize';
import { CardExpansion } from './card-expansion';

// MIT-licensed Heroicons v1 paths
const ICON_EDIT = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);
const ICON_DELETE = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

interface CardsProps {
  events: EventListItem[];
  view: ViewState;
  size: ViewportSize;
  weekdays: WeekdayColors;
  inGameNowSeconds: number;
  expansion: CardExpansionState | null;
  previewSize: PreviewSize;
  onCardClick: (filename: string) => void;
  onPreviewSizeChange: (s: PreviewSize) => void;
  onResizeDragChange: (active: boolean) => void;
  onEditClick: (filename: string) => void;
  onDeleteClick: (item: EventListItem) => void;
  onContextMenu?: (item: EventListItem, x: number, y: number) => void;
  onOpenById?: (id: string) => void;
  onRemoveTag?: (filename: string, tag: string) => void;
  entityLabelMap?: Map<string, string>;
  entityTagLabelMap?: Map<string, string>;
}

export function Cards({
  events,
  view,
  size,
  weekdays,
  inGameNowSeconds,
  expansion,
  previewSize,
  onCardClick,
  onPreviewSizeChange,
  onResizeDragChange,
  onEditClick,
  onDeleteClick,
  onContextMenu,
  onOpenById,
  onRemoveTag,
  entityLabelMap,
  entityTagLabelMap,
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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Connectors first so cards render on top */}
      {placed.map((card) => (
        <div
          key={`conn-${card.event.filename}`}
          className="event-card-connector"
          data-filename={card.event.filename}
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
          data-filename={card.event.filename}
          style={{ left: card.x, top: axisY }}
        />
      ))}
      {placed.map((card) => {
        const isExpanded = expansion?.filename === card.event.filename;
        const normalTop = axisY - CARD_HEIGHT - CARD_GAP - card.row * (CARD_HEIGHT + CARD_GAP);
        const { expandsDown, cardTop, cardWidth } = isExpanded
          ? computeExpansionLayout(
              normalTop,
              previewSize.expandedHeight,
              card.width,
              previewSize.width,
            )
          : { expandsDown: false, cardTop: normalTop, cardWidth: card.width };

        const color = card.event.color ?? weekdayColor(card.parsedDate, weekdays);

        return (
          <CardItem
            key={card.event.filename}
            card={card}
            isExpanded={isExpanded}
            cardTop={cardTop}
            cardWidth={cardWidth}
            color={color}
            expandsDown={expandsDown}
            expansion={expansion}
            previewSize={previewSize}
            onCardClick={onCardClick}
            onPreviewSizeChange={onPreviewSizeChange}
            onResizeDragChange={onResizeDragChange}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            onContextMenu={onContextMenu}
            onOpenById={onOpenById}
            onRemoveTag={onRemoveTag}
            entityLabelMap={entityLabelMap}
            entityTagLabelMap={entityTagLabelMap}
          />
        );
      })}
    </div>
  );
}

interface CardItemProps {
  card: LaidOutCard & CardPlacement;
  isExpanded: boolean;
  cardTop: number;
  cardWidth: number;
  color: string;
  expandsDown: boolean;
  expansion: CardExpansionState | null;
  previewSize: PreviewSize;
  onCardClick: (filename: string) => void;
  onPreviewSizeChange: (s: PreviewSize) => void;
  onResizeDragChange: (active: boolean) => void;
  onEditClick: (filename: string) => void;
  onDeleteClick: (item: EventListItem) => void;
  onContextMenu?: (item: EventListItem, x: number, y: number) => void;
  onOpenById?: (id: string) => void;
  onRemoveTag?: (filename: string, tag: string) => void;
  entityLabelMap?: Map<string, string>;
  entityTagLabelMap?: Map<string, string>;
}

function CardItem({
  card,
  isExpanded,
  cardTop,
  cardWidth,
  color,
  expandsDown,
  expansion,
  previewSize,
  onCardClick,
  onPreviewSizeChange,
  onResizeDragChange,
  onEditClick,
  onDeleteClick,
  onContextMenu,
  onOpenById,
  onRemoveTag,
  entityLabelMap,
  entityTagLabelMap,
}: CardItemProps): ReactElement {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCardClick(card.event.filename);
    },
    [card.event.filename, onCardClick],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!onContextMenu) return;
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(card.event, e.clientX, e.clientY);
    },
    [card.event, onContextMenu],
  );

  const expansionEl = isExpanded ? (
    <CardExpansion
      body={expansion?.body ?? null}
      expandsDown={expandsDown}
      size={previewSize}
      centerX={card.x}
      onSizeChange={onPreviewSizeChange}
      onResizeDragChange={onResizeDragChange}
      onOpenById={onOpenById}
      entityLabelMap={entityLabelMap}
    />
  ) : null;

  const tags = card.event.tags;

  return (
    <div
      className={`event-card${card.isFuture ? ' is-future' : ''}${isExpanded ? ' is-expanded' : ''}`}
      data-filename={card.event.filename}
      style={
        {
          left: card.x - cardWidth / 2,
          width: cardWidth,
          top: cardTop,
          '--weekday-color': color,
          pointerEvents: 'auto',
        } as CSSProperties
      }
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Expansion section above the card face when opening upward */}
      {isExpanded && !expandsDown && expansionEl}

      <div className="event-card-header" />
      <div className="event-card-body">
        <div className="event-card-title-row">
          <div className="event-card-title">{card.event.title}</div>
          <div className="event-card-actions">
            <button
              className="event-card-action-btn event-card-action-btn--danger"
              data-action="delete"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                void onDeleteClick(card.event);
              }}
            >
              {ICON_DELETE}
            </button>
            <button
              className="event-card-action-btn event-card-action-btn--primary"
              data-action="edit"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEditClick(card.event.filename);
              }}
            >
              {ICON_EDIT}
            </button>
          </div>
        </div>
        <div className="event-card-date">{formatCardFace(card.parsedDate)}</div>
        {tags && tags.length > 0 && (
          <div className="event-card-tags">
            {tags.map((t) => {
              const { display, isEntity } = resolveEntityTagLabel(t, entityTagLabelMap);
              const canRemove = !!onRemoveTag && isValidCustomTag(t);
              return (
                <span
                  key={t}
                  className={`event-card-tag${isEntity ? ' entity-tag-chip--resolved' : ''}`}
                >
                  {display}
                  {canRemove && (
                    <button
                      type="button"
                      className="event-card-tag-remove"
                      aria-label={`Remove tag ${t}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag!(card.event.filename, t);
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Expansion section below the card face when opening downward */}
      {isExpanded && expandsDown && expansionEl}
    </div>
  );
}
