import type { DateField, DateFilter, Filter } from './types';
import { nowForField } from './logic';

export interface DateEditorProps {
  filter: DateFilter;
  inGameNow: string;
  onUpdate: (f: Filter) => void;
  onDone: () => void;
}

export function DateEditor({ filter, inGameNow, onUpdate, onDone }: DateEditorProps) {
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onUpdate({ ...filter, from: (e.target as HTMLInputElement).value.trim() || null });
              onDone();
            }
          }}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onUpdate({ ...filter, to: (e.target as HTMLInputElement).value.trim() || null });
              onDone();
            }
          }}
        />
      </label>
      <button type="button" className="filter-editor-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
