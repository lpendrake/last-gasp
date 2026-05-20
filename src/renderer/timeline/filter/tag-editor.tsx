import { useState } from 'react';
import type { EventListItem } from '../data/types';
import type { Filter, TagFilter } from './types';
import { collectAllTags } from './logic';

export interface TagEditorProps {
  filter: TagFilter;
  events: EventListItem[];
  onUpdate: (f: Filter) => void;
  onDone: () => void;
}

export function TagEditor({ filter, events, onUpdate, onDone }: TagEditorProps) {
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
