import React, { useState, useEffect, useMemo, useRef } from 'react';
import { folderColor, slugify } from './types.ts';

const KNOWN_KINDS = [
  { folder: 'npcs',           label: 'NPC',           desc: 'A person — ally, foe, or wandering merchant', kbd: '1' },
  { folder: 'locations',      label: 'Location',      desc: 'A place — city, dungeon, landmark',           kbd: '2' },
  { folder: 'factions',       label: 'Faction',       desc: 'An organisation — church, guild, cabal',      kbd: '3' },
  { folder: 'plots',          label: 'Plot',           desc: 'A storyline thread',                         kbd: '4' },
  { folder: 'rules',          label: 'House rule',    desc: 'House rules and rulings',                     kbd: '5' },
  { folder: 'player-facing',  label: 'Player-facing', desc: 'Recap or handout',                           kbd: '6' },
  { folder: 'misc',           label: 'Misc',           desc: 'Anything else',                              kbd: '7' },
] as const;

interface KindRow {
  folder: string;
  label: string;
  desc?: string;
  kbd?: string;
}

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

  // Build ordered kind list: known kinds first, then any extra folders not in the list
  const allKinds = useMemo<KindRow[]>(() => {
    const knownFolders = new Set(KNOWN_KINDS.map(k => k.folder));
    const extras = folders
      .filter(f => !knownFolders.has(f))
      .map(f => ({ folder: f, label: f }));
    return [...KNOWN_KINDS, ...extras];
  }, [folders]);

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

  const filtered = useMemo<KindRow[]>(() => {
    if (step !== 0) return allKinds;
    const q = filter.toLowerCase().trim();
    if (!q) return allKinds;
    return allKinds.filter(k =>
      k.folder.toLowerCase().includes(q) ||
      k.label.toLowerCase().includes(q) ||
      k.desc?.toLowerCase().includes(q),
    );
  }, [filter, step, allKinds]);

  if (!open) return null;

  function pickKind(k: KindRow) {
    setFolder(k.folder);
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
      // Number shortcuts 1–7 for the fixed kinds (only when filter is empty)
      if (!filter) {
        const numMatch = KNOWN_KINDS.find(k => k.kbd === e.key);
        if (numMatch) { e.preventDefault(); pickKind(numMatch); return; }
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); if (filtered[selected]) pickKind(filtered[selected]); return; }
    } else {
      if (e.key === 'Enter')     { e.preventDefault(); commit(); return; }
      if (e.key === 'Backspace' && !title) { e.preventDefault(); setStep(0); setFolder(null); return; }
    }
  }

  const selectedKind = folder ? allKinds.find(k => k.folder === folder) : null;
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
                placeholder="What kind of note? (type or press 1–7)"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setSelected(0); }}
                onKeyDown={onKey}
              />
            </>
          ) : (
            <>
              <span className="cmdk-prefix" style={{ color }}>
                + {(selectedKind?.label ?? folder)?.toUpperCase()}
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
              : <div className="cmdk-section-label">Pick a type</div>}
            <div className="cmdk-list">
              {filtered.length === 0
                ? <div className="cmdk-empty">No matching kinds</div>
                : filtered.map((k, i) => (
                  <div
                    key={k.folder}
                    className={`cmdk-row${i === selected ? ' is-selected' : ''}`}
                    style={{ '--kind-color': folderColor(k.folder) } as React.CSSProperties}
                    onMouseEnter={() => setSelected(i)}
                    onMouseDown={(e) => { e.preventDefault(); pickKind(k); }}
                  >
                    <span className="cmdk-row-pip" />
                    <div className="cmdk-row-main">
                      <div className="cmdk-row-action">New <b>{k.label}</b></div>
                      {k.desc && <div className="cmdk-row-meta">{k.desc}</div>}
                    </div>
                    {k.kbd && <span className="cmdk-row-kbd">{k.kbd}</span>}
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
                <div className="cmdk-row-meta">A new {selectedKind?.label.toLowerCase() ?? folder} will open in a tab</div>
              </div>
            </div>
          </div>
        )}

        <div className="cmdk-footer">
          {step === 0
            ? <><span><kbd>↑↓</kbd>navigate</span><span><kbd>↵</kbd>select</span><span><kbd>1–7</kbd>quick-pick</span><span><kbd>esc</kbd>close</span></>
            : <><span><kbd>↵</kbd>create &amp; open</span><span><kbd>⌫</kbd>back</span><span><kbd>esc</kbd>close</span></>
          }
        </div>
      </div>
    </div>
  );
}
