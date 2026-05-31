import './controls.css';

interface Props {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  disabled?: boolean;
}

export function TextField({ id, value, onChange, placeholder, type = 'text', disabled }: Props) {
  return (
    <input
      id={id}
      type={type}
      className="settings-text-field"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
