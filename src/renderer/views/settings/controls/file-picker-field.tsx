import './controls.css';

interface Props {
  id?: string;
  value: string | null;
  onChange: (path: string | null) => void;
  buttonLabel?: string;
  disabled?: boolean;
}

async function pickFile(onChange: (path: string | null) => void): Promise<void> {
  const api = window.fsApi as typeof window.fsApi & {
    selectFile: () => Promise<string | null>;
  };
  const path = await api.selectFile();
  if (path !== null) {
    onChange(path);
  }
}

export function FilePickerField({
  id,
  value,
  onChange,
  buttonLabel = 'Choose file…',
  disabled,
}: Props) {
  return (
    <div id={id} className="settings-file-picker">
      <button
        type="button"
        className="settings-file-picker__btn"
        disabled={disabled}
        onClick={() => void pickFile(onChange)}
      >
        {buttonLabel}
      </button>
      {value !== null ? (
        <span className="settings-file-picker__path" title={value}>
          {value}
        </span>
      ) : (
        <span className="settings-file-picker__path settings-file-picker__path--none">
          No file selected
        </span>
      )}
    </div>
  );
}
