import './controls.css';

interface Props {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export function SliderField({
  id,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="settings-slider-field">
      <input
        id={id}
        type="range"
        className="settings-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="settings-slider-field__value">{value}</span>
    </div>
  );
}
