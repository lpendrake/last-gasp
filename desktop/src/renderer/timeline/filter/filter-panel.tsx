import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EventListItem, Session } from '../data/types';
import type { DateFilter, Filter, FilterState, TagFilter } from './types';
import { newFilterId, nowForField } from './logic';
import { FilterChip } from './filter-chip';
import './filter-panel.css';

export interface FilterPanelProps {
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
