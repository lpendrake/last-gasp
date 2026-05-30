import { useCallback, useState } from 'react';
import type { ColorPreset } from '../../theme/types';
import { useContextMenuBehavior } from '../../shared/use-context-menu-behavior';

interface ColorSelectProps {
  presets: ColorPreset[];
  value: string;
  weekdayColor: string | null;
  customColor?: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

function swatchFor(preset: ColorPreset, weekdayColor: string | null, customColor?: string): string {
  if (preset.value === '') return weekdayColor ?? 'transparent';
  if (preset.value === '__custom__') return customColor ?? 'transparent';
  return preset.value;
}

function selectedLabel(presets: ColorPreset[], value: string): string {
  const found = presets.find((p) => p.value === value);
  return found?.label ?? value;
}

interface PopoverProps {
  presets: ColorPreset[];
  value: string;
  weekdayColor: string | null;
  customColor?: string;
  anchorX: number;
  anchorY: number;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function ColorSelectPopover({
  presets,
  value,
  weekdayColor,
  customColor,
  anchorX,
  anchorY,
  onSelect,
  onClose,
}: PopoverProps) {
  const { menuRef, pos } = useContextMenuBehavior(anchorX, anchorY, onClose);

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Color options"
      className="event-editor-color-popover"
      style={{ left: pos.x, top: pos.y }}
    >
      {presets.map((preset) => {
        const swatch = swatchFor(preset, weekdayColor, customColor);
        const isSelected = preset.value === value;
        const isCustomOrDefault = preset.value === '' || preset.value === '__custom__';
        return (
          <button
            key={preset.value === '' ? '__default__' : preset.value}
            role="option"
            aria-selected={isSelected}
            className={`event-editor-color-option${isSelected ? ' event-editor-color-option--selected' : ''}`}
            onClick={() => {
              onSelect(preset.value);
              onClose();
            }}
          >
            <span
              className={`event-editor-color-swatch-sm${isCustomOrDefault ? ' event-editor-color-swatch-sm--dashed' : ''}`}
              style={{ background: swatch }}
              aria-hidden="true"
            />
            <span className="event-editor-color-option-label">{preset.label}</span>
            {isSelected && (
              <span className="event-editor-color-option-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ColorSelect({
  presets,
  value,
  weekdayColor,
  customColor,
  onChange,
  ariaLabel,
}: ColorSelectProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  const handleTriggerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (open) {
        setOpen(false);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      setAnchor({ x: rect.left, y: rect.bottom + 2 });
      setOpen(true);
    },
    [open],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
    },
    [onChange],
  );

  return (
    <span className="event-editor-color-trigger-wrap">
      <button
        type="button"
        className="event-editor-color-trigger"
        aria-label={ariaLabel ?? 'Select colour'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleTriggerClick}
      >
        <span className="event-editor-color-trigger-label">{selectedLabel(presets, value)}</span>
        <span className="event-editor-color-trigger-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ColorSelectPopover
          presets={presets}
          value={value}
          weekdayColor={weekdayColor}
          customColor={customColor}
          anchorX={anchor.x}
          anchorY={anchor.y}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </span>
  );
}
