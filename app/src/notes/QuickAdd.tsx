import React, { useState, useEffect, useMemo, useRef } from 'react';
import { folderColor, slugify } from './types.ts';

interface QuickAddProps {
  open: boolean;
  folders: string[];
  initialText?: string;
  initialFolder?: string;
  onClose: () => void;
  onCreate: (opts: { folder: string; title: string }) => void;
}

export function QuickAdd({ open, folders, initialText, initialFolder, onClose, onCreate }: QuickAddProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (initialFolder) {
        setFolder(initialFolder);
        setStep(1);
      } else {
        setStep(0);
        setFolder(null);
      }
      setTitle(initialText ?? '');
      setFilter('');
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialText, initialFolder]);

  const filtered = useMemo(() => {
    if (step !== 0) return folders;
    const q = filter.toLowerCase().trim();
    if (!q) return folders;
    return folders.filter(f => f.toLowerCase().includes(q));
  }, [filter, step, folders]);

  if (!open) return null;

  function pickFolder(f: string) {
    setFolder(f);
    setStep(1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    if (!folder || !title.trim()) return;
    onCreate({ folder, title: title.trim() });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (step === 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); if (filtered[selected]) pickFolder(filtered[selected]); return; }
    } else {
      if (e.key === 'Enter')     { e.preventDefault(); commit(); return; }
      if (e.key === 'Backspace' && !title) { e.preventDefault(); setStep(0); setFolder(null); return; }
    }
  }

  const color = folder ? folderColor(folder) : undefined;

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          {step === 0 ? (
            <>
              <span className="cmdk-prefix">+ NEW</span>
              <input
                ref={inputRef}
                className="cmdk-input"
                placeholder="Which folder? (type to filter)"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setSelected(0); }}
                onKeyDown={onKey}
              />
            </>
          ) : (
            <>
              <span className="cmdk-prefix" style={{ color }}>
                + {folder?.toUpperCase()}
              </span>
              <input
                ref={inputRef}
                className="cmdk-input"
                placeholder="Title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={onKey}
              />
            </>
          )}
        </div>

        {step === 0 && (
          <>
            {initialText
              ? <div className="cmdk-section-label">From selection: "{initialText.slice(0, 60)}"</div>
              : <div className="cmdk-section-label">Pick a folder</div>}
            <div className="cmdk-list">
              {filtered.length === 0
                ? <div className="cmdk-empty">No matching folders</div>
                : filtered.map((f, i) => (
                  <div
                    key={f}
                    className={`cmdk-row${i === selected ? ' is-selected' : ''}`}
                    style={{ '--kind-color': folderColor(f) } as React.CSSProperties}
                    onMouseEnter={() => setSelected(i)}
                    onMouseDown={(e) => { e.preventDefault(); pickFolder(f); }}
                  >
                    <span className="cmdk-row-pip" />
                    <div className="cmdk-row-main">
                      <div className="cmdk-row-action">New note in <b>{f}/</b></div>
                    </div>
                  </div>
                ))
              }
            </div>
          </>
        )}

        {step === 1 && folder && (
          <div className="cmdk-list">
            <div className="cmdk-section-label">Will be created at</div>
            <div className="cmdk-row" style={{ '--kind-color': color, cursor: 'default' } as React.CSSProperties}>
              <span className="cmdk-row-pip" />
              <div className="cmdk-row-main">
                <div className="cmdk-row-action">{folder}/<b>{slugify(title) || '…'}</b>.md</div>
                <div className="cmdk-row-meta">Opens in a new tab after creation</div>
              </div>
            </div>
          </div>
        )}

        <div className="cmdk-footer">
          {step === 0
            ? <><span><kbd>↑↓</kbd>navigate</span><span><kbd>↵</kbd>select</span><span><kbd>esc</kbd>close</span></>
            : <><span><kbd>↵</kbd>create &amp; open</span><span><kbd>⌫</kbd>back</span><span><kbd>esc</kbd>close</span></>
          }
        </div>
      </div>
    </div>
  );
}
