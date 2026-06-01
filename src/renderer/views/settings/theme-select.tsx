import './controls/controls.css';
import type { CoreThemeOption } from './domain/theme-options';

interface Props {
  id?: string;
  value: string;
  coreThemes: CoreThemeOption[];
  onChange: (id: string) => void;
  /** When true, renders a leading "Use Default" option above the theme groups. */
  includeUseDefault?: boolean;
}

export function ThemeSelect({ id, value, coreThemes, onChange, includeUseDefault }: Props) {
  return (
    <select
      id={id}
      className="settings-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeUseDefault && <option value="">Use Default</option>}
      <optgroup label="Core">
        {coreThemes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Custom">
        <option disabled value="">
          Coming Soon
        </option>
      </optgroup>
    </select>
  );
}
