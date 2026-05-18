import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EventListItem, Session } from '../data/types';
import type { DateField, DateFilter, Filter, FilterState, TagFilter } from './types';
import { collectAllTags, filterSummary, newFilterId, nowForField } from './logic';
import './filter-panel.css';

interface FilterPanelProps {
  filterState: FilterState;
  events: EventListItem[];
  sessions: Session[];
  inGameNow: string;
  onAdd: (f: Filter) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onPin: (id: string) => void;
  onUpdate: (f: Filter) => void;
}

export function FilterPanel({
  filterState,
  events,
  sessions,
  inGameNow,
  onAdd,
  onRemove,
  onToggle,
  onPin,
  onUpdate,
}: FilterPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  function openEditor(id: string) {
    setEditingId((prev) => (prev === id ? null : id));
  }

  function addTagFilter() {
    const id = newFilterId();
    const f: TagFilter = { id, type: 'tag', enabled: true, pinned: false, tags: [] };
    onAdd(f);
    setEditingId(id);
    setAddMenuOpen(false);
  }

  function addDateFilter() {
    const id = newFilterId();
    const today = new Date().toISOString().slice(0, 10);
    const f: DateFilter = {
      id,
      type: 'date',
      enabled: true,
      pinned: false,
      field: 'in-game',
      from: null,
      to: nowForField('in-game', inGameNow, today),
    };
    onAdd(f);
    setEditingId(id);
    setAddMenuOpen(false);
  }

  // Close add menu when clicking outside.
  useEffect(() => {
    if (!addMenuOpen) return;
    function handleClick() {
      setAddMenuOpen(false);
    }
    // setTimeout so the opening click doesn't immediately close the menu.
    const id = setTimeout(() => document.addEventListener('click', handleClick, { once: true }), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handleClick);
    };
  }, [addMenuOpen]);

  const content = (
    <div className="filter-panel">
      <div className="filter-bar">
        {/* Add filter button */}
        <div className="filter-add-wrap">
          <button
            ref={addBtnRef}
            type="button"
            className="filter-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              setAddMenuOpen((open) => !open);
            }}
          >
            + Add filter
          </button>
          {addMenuOpen && (
            <ul className="filter-add-menu">
              <li>
                <button type="button" onClick={addTagFilter}>
                  Tag filter
                </button>
              </li>
              <li>
                <button type="button" onClick={addDateFilter}>
                  Date range
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Filter chips */}
        {filterState.filters.map((f) => (
          <FilterChip
            key={f.id}
            filter={f}
            isEditing={editingId === f.id}
            events={events}
            sessions={sessions}
            inGameNow={inGameNow}
            onToggle={() => onToggle(f.id)}
            onPin={() => onPin(f.id)}
            onRemove={() => {
              if (editingId === f.id) setEditingId(null);
              onRemove(f.id);
            }}
            onEditClick={() => openEditor(f.id)}
            onUpdate={onUpdate}
            onDoneEditing={() => setEditingId(null)}
          />
        ))}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

interface FilterChipProps {
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

function FilterChip({
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

interface TagEditorProps {
  filter: TagFilter;
  events: EventListItem[];
  onUpdate: (f: Filter) => void;
  onDone: () => void;
}

function TagEditor({ filter, events, onUpdate, onDone }: TagEditorProps) {
  const [query, setQuery] = useState('');
  const allTags = collectAllTags(events);
  const results = allTags
    .filter((t) => !filter.tags.includes(t) && t.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="filter-editor filter-editor-popover">
      <div className="filter-tag-chips">
        {filter.tags.map((tag) => (
          <span key={tag} className="filter-chip">
            {tag}
            <button
              type="button"
              className="filter-chip-remove"
              onClick={() => onUpdate({ ...filter, tags: filter.tags.filter((t) => t !== tag) })}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="filter-tag-input"
        placeholder="Search tags…"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="filter-tag-results">
          {results.map((tag) => (
            <li
              key={tag}
              className="filter-tag-result"
              onClick={() => {
                onUpdate({ ...filter, tags: [...filter.tags, tag] });
                setQuery('');
              }}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="filter-editor-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

interface DateEditorProps {
  filter: DateFilter;
  inGameNow: string;
  onUpdate: (f: Filter) => void;
  onDone: () => void;
}

function DateEditor({ filter, inGameNow, onUpdate, onDone }: DateEditorProps) {
  const today = new Date().toISOString().slice(0, 10);

  function handleFieldChange(field: DateField) {
    onUpdate({
      ...filter,
      field,
      from: null,
      to: nowForField(field, inGameNow, today),
    });
  }

  return (
    <div className="filter-editor filter-editor-popover">
      <div className="filter-date-field-row">
        {(['in-game', 'session', 'creation'] as DateField[]).map((f) => (
          <label key={f}>
            <input
              type="radio"
              name={`field-${filter.id}`}
              value={f}
              checked={filter.field === f}
              onChange={() => handleFieldChange(f)}
            />
            {f === 'in-game' ? 'In-game' : f === 'session' ? 'Session' : 'Created'}
          </label>
        ))}
      </div>
      <label className="filter-date-label">
        From
        <input
          type="text"
          className="filter-date-input"
          placeholder="YYYY-MM-DD"
          defaultValue={filter.from ?? ''}
          onBlur={(e) => onUpdate({ ...filter, from: e.target.value.trim() || null })}
        />
      </label>
      <label className="filter-date-label">
        To
        <input
          type="text"
          className="filter-date-input"
          placeholder="YYYY-MM-DD"
          defaultValue={filter.to ?? ''}
          onBlur={(e) => onUpdate({ ...filter, to: e.target.value.trim() || null })}
        />
      </label>
      <button type="button" className="filter-editor-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
