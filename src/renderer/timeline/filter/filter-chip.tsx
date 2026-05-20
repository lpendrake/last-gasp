import type { EventListItem, Session } from '../data/types';
import type { Filter } from './types';
import { filterSummary } from './logic';
import { TagEditor } from './tag-editor';
import { DateEditor } from './date-editor';

export interface FilterChipProps {
  filter: Filter;
  isEditing: boolean;
  events: EventListItem[];
  sessions: Session[];
  inGameNow: string;
  onToggle: () => void;
  onPin: () => void;
  onRemove: () => void;
  onEditClick: () => void;
  onUpdate: (f: Filter) => void;
  onDoneEditing: () => void;
}

export function FilterChip({
  filter,
  isEditing,
  events,
  inGameNow,
  onToggle,
  onPin,
  onRemove,
  onEditClick,
  onUpdate,
  onDoneEditing,
}: FilterChipProps) {
  return (
    <div className={`filter-chip-row${filter.enabled ? '' : ' is-disabled'}`}>
      <input
        type="checkbox"
        checked={filter.enabled}
        title={filter.enabled ? 'Disable' : 'Enable'}
        onChange={onToggle}
      />
      <button type="button" className="filter-chip-summary" title="Edit" onClick={onEditClick}>
        {filterSummary(filter)}
      </button>
      <button
        type="button"
        className={`filter-chip-icon filter-chip-pin${filter.pinned ? ' is-active' : ''}`}
        title={filter.pinned ? 'Unpin' : 'Pin (persist across sessions)'}
        onClick={onPin}
      >
        {filter.pinned ? '★' : '☆'}
      </button>
      <button type="button" className="filter-chip-icon" title="Remove" onClick={onRemove}>
        ×
      </button>
      {isEditing &&
        (filter.type === 'tag' ? (
          <TagEditor filter={filter} events={events} onUpdate={onUpdate} onDone={onDoneEditing} />
        ) : (
          <DateEditor
            filter={filter}
            inGameNow={inGameNow}
            onUpdate={onUpdate}
            onDone={onDoneEditing}
          />
        ))}
    </div>
  );
}
