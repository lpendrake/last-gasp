import { useState } from 'react';
import type { EventListItem } from '../data/types';
import type { Filter, TagFilter } from './types';
import { collectAllTags } from './logic';
import { resolveEntityTagLabel } from '../../../shared/entity-tags';

export interface TagEditorProps {
  filter: TagFilter;
  events: EventListItem[];
  entityTagLabelMap?: Map<string, string>;
  onUpdate: (f: Filter) => void;
  onDone: () => void;
}

export function TagEditor({ filter, events, entityTagLabelMap, onUpdate, onDone }: TagEditorProps) {
  const [query, setQuery] = useState('');
  const allTags = collectAllTags(events, entityTagLabelMap);
  const results = allTags
    .filter(
      (t) => !filter.tags.includes(t.raw) && t.display.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);

  return (
    <div className="filter-editor filter-editor-popover">
      <div className="filter-tag-chips">
        {filter.tags.map((raw) => {
          const { display, isEntity } = resolveEntityTagLabel(raw, entityTagLabelMap);
          return (
            <span
              key={raw}
              className={`filter-chip${isEntity ? ' entity-tag-chip--resolved' : ''}`}
            >
              {display}
              <button
                type="button"
                className="filter-chip-remove"
                onClick={() => onUpdate({ ...filter, tags: filter.tags.filter((t) => t !== raw) })}
              >
                ×
              </button>
            </span>
          );
        })}
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
              key={tag.raw}
              className={`filter-tag-result${tag.isEntity ? ' filter-tag-result--entity' : ''}`}
              onClick={() => {
                onUpdate({ ...filter, tags: [...filter.tags, tag.raw] });
                setQuery('');
              }}
            >
              {tag.display}
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
