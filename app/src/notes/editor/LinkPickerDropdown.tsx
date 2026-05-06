import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { LinkIndexEntry } from '../../data/types.ts';
import { folderColor } from '../types.ts';
import type { LinkPickerHandle } from '../hooks/useLinkPicker.ts';

interface LinkPickerDropdownProps {
  x: number;
  y: number;
  items: LinkIndexEntry[];
  onPick: (entry: LinkIndexEntry) => void;
  onClose: () => void;
}

/** The @-mention dropdown rendered next to the caret in the live
 * editor. The parent passes the picker state via `useLinkPicker` and
 * forwards the imperative `handleKey` ref so keyboard navigation
 * (ArrowUp/Down, Enter) goes through this component. */
export const LinkPickerDropdown = forwardRef<LinkPickerHandle, LinkPickerDropdownProps>(
  function LinkPickerDropdown({ x, y, items, onPick, onClose: _onClose }, ref) {
    const [selected, setSelected] = useState(0);
    useEffect(() => { setSelected(0); }, [items]);
    useImperativeHandle(ref, () => ({
      handleKey(key: string): boolean {
        if (key === 'ArrowDown') { setSelected(s => Math.min(s + 1, items.length - 1)); return true; }
        if (key === 'ArrowUp') { setSelected(s => Math.max(s - 1, 0)); return true; }
        if (key === 'Enter') { if (items[selected]) onPick(items[selected]); return true; }
        return false;
      },
    }), [items, selected, onPick]);

    if (items.length === 0) {
      return (
        <div className="link-picker" style={{ left: x, top: y }}>
          <div style={{ padding: '10px 12px', color: 'var(--theme-text-muted)', fontSize: 13 }}>No matches</div>
        </div>
      );
    }
    return (
      <div className="link-picker" style={{ left: x, top: y }}>
        {items.map((it, i) => {
          const folder = it.path.split('/')[0];
          return (
            <div
              key={it.path}
              className={`link-picker-row${i === selected ? ' is-selected' : ''}`}
              style={{ '--kind-color': folderColor(folder) } as React.CSSProperties}
              onMouseDown={(e) => { e.preventDefault(); onPick(it); }}
            >
              <span className="pip" />
              <span className="ttl">{it.title}</span>
              <span className="pth">{it.path}</span>
            </div>
          );
        })}
      </div>
    );
  },
);
