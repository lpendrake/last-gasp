import './controls.css';

interface Props {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, htmlFor, children }: Props) {
  return (
    <div className="setting-row">
      <div className="setting-row__label-group">
        <label className="setting-row__label" htmlFor={htmlFor}>
          {label}
        </label>
        {description && <p className="setting-row__description">{description}</p>}
      </div>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}
