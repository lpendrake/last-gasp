import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  parseISOString,
  toISOString,
  toAbsoluteSeconds,
  fromAbsoluteSeconds,
} from '../calendar/golarian';
import { formatExpanded } from '../calendar/format';
import './AdvanceTimePopover.css';

interface AdvanceTimePopoverProps {
  /** Viewport-relative click position — popover appears above this point. */
  anchor: { x: number; y: number };
  currentNow: string;
  onSave: (newNow: string) => Promise<void>;
  onClose: () => void;
}

const QUICK_DELTAS: { label: string; delta: number }[] = [
  { label: '+1 hour', delta: 3600 },
  { label: '+6 hours', delta: 6 * 3600 },
  { label: '+1 day', delta: 86400 },
  { label: '+1 week', delta: 7 * 86400 },
];

export function AdvanceTimePopover({
  anchor,
  currentNow,
  onSave,
  onClose,
}: AdvanceTimePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const baseSecs = toAbsoluteSeconds(parseISOString(currentNow));
  const [pendingSecs, setPendingSecs] = useState(baseSecs);
  const [inputValue, setInputValue] = useState(currentNow);
  const [inputError, setInputError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let removeHandler: (() => void) | undefined;
    const id = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handler, true);
      removeHandler = () => document.removeEventListener('mousedown', handler, true);
    }, 0);
    return () => {
      clearTimeout(id);
      removeHandler?.();
    };
  }, [onClose]);

  function applyDelta(delta: number) {
    const next = baseSecs + delta;
    setPendingSecs(next);
    setInputValue(toISOString(fromAbsoluteSeconds(next)));
    setInputError(false);
  }

  function handleInput(value: string) {
    setInputValue(value);
    try {
      const d = parseISOString(value.trim());
      setPendingSecs(toAbsoluteSeconds(d));
      setInputError(false);
    } catch {
      setInputError(true);
    }
  }

  async function handleSave() {
    if (inputError || saving) return;
    setSaving(true);
    try {
      await onSave(toISOString(fromAbsoluteSeconds(pendingSecs)));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const popoverWidth = 300;
  const left = Math.min(anchor.x, window.innerWidth - popoverWidth - 12);
  const style: CSSProperties = {
    position: 'fixed',
    left: Math.max(12, left),
    bottom: window.innerHeight - anchor.y + 6,
    zIndex: 500,
  };

  return createPortal(
    <div ref={popoverRef} className="advance-time-popover" style={style}>
      <div className="atp-title">Advance Time</div>
      <div className="atp-current">{formatExpanded(fromAbsoluteSeconds(pendingSecs))}</div>
      <div className="atp-quick-row">
        {QUICK_DELTAS.map(({ label, delta }) => (
          <button key={label} onClick={() => applyDelta(delta)}>
            {label}
          </button>
        ))}
      </div>
      <div className="atp-row">
        <label className="atp-label">Set directly</label>
        <input
          className={`atp-input${inputError ? ' is-error' : ''}`}
          type="text"
          value={inputValue}
          placeholder="4726-05-04T09:30"
          onChange={(e) => handleInput(e.target.value)}
        />
      </div>
      <div className="atp-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="is-primary"
          onClick={() => void handleSave()}
          disabled={inputError || saving}
        >
          Save
        </button>
      </div>
    </div>,
    document.body,
  );
}
