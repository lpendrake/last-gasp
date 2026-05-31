import './controls.css';

interface Option {
  value: string;
  label: string;
}

interface Props {
  id?: string;
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function SelectField({ id, value, options, onChange, disabled }: Props) {
  return (
    <select
      id={id}
      className="settings-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
