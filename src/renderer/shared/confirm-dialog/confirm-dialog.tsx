import { useEffect, useRef } from 'react';
import './confirm-dialog.css';

export interface ConfirmDialogProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  okLabel?: string;
  danger?: boolean;
  mode: 'confirm' | 'alert';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  okLabel = 'OK',
  danger = false,
  mode,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the primary button on mount
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  // Keyboard handling: Escape => cancel, Enter => confirm (capture phase)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onConfirm, onCancel]);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const confirmBtnClass = [
    'confirm-dialog-btn',
    'confirm-dialog-btn--primary',
    danger ? 'confirm-dialog-btn--danger' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="confirm-dialog-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div className="confirm-dialog-panel">
        {title && <h2 className="confirm-dialog-title">{title}</h2>}
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-buttons">
          {mode === 'confirm' && (
            <button type="button" className="confirm-dialog-btn" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button ref={primaryBtnRef} type="button" className={confirmBtnClass} onClick={onConfirm}>
            {mode === 'alert' ? okLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
