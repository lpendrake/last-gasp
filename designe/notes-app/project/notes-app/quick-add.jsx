/* global React */
const { useState, useEffect, useMemo, useRef } = React;

// ============================================================
//   <QuickAddPalette /> — command-palette-style overlay
//   Steps:
//   1. Choose kind (NPC/Location/Faction/Plot/Rule/Misc) — or type ↑↓ Enter
//   2. Edit title (pre-seeded from selection)
//   3. Press Enter → creates file and (optionally) opens it
// ============================================================
function QuickAddPalette({ open, initialText, onClose, onCreate }) {
  const [step, setStep] = useState(0);    // 0 = kind, 1 = title
  const [kind, setKind] = useState(null);
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  const KINDS = [
    { id: 'npcs',           kindKey: 'npc',           label: 'NPC',           desc: 'A person — ally, foe, or wandering merchant', kbd: '1' },
    { id: 'locations',      kindKey: 'location',      label: 'Location',      desc: 'A place — city, dungeon, landmark', kbd: '2' },
    { id: 'factions',       kindKey: 'faction',       label: 'Faction',       desc: 'An organisation — church, guild, cabal', kbd: '3' },
    { id: 'plots',          kindKey: 'plot',          label: 'Plot',          desc: 'A storyline thread', kbd: '4' },
    { id: 'rules',          kindKey: 'rule',          label: 'House rule',    desc: 'House rules and rulings', kbd: '5' },
    { id: 'player-facing',  kindKey: 'player-facing', label: 'Player-facing', desc: 'Recap or handout', kbd: '6' },
    { id: 'misc',           kindKey: 'misc',          label: 'Misc',          desc: 'Anything else', kbd: '7' },
  ];

  useEffect(() => {
    if (open) {
      setStep(0);
      setKind(null);
      setTitle(initialText || '');
      setFilter('');
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialText]);

  const filtered = useMemo(() => {
    if (step !== 0) return KINDS;
    const q = filter.toLowerCase().trim();
    if (!q) return KINDS;
    return KINDS.filter(k => k.label.toLowerCase().includes(q) || k.desc.toLowerCase().includes(q));
  }, [filter, step]);

  if (!open) return null;

  function pickKind(k) {
    setKind(k);
    setStep(1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    if (!kind || !title.trim()) return;
    onCreate({ folder: kind.id, kind: kind.kindKey, title: title.trim() });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (step === 0) {
      // Number shortcut
      const numMatch = KINDS.find(k => k.kbd === e.key);
      if (numMatch && !filter) { e.preventDefault(); pickKind(numMatch); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) pickKind(filtered[selected]); return; }
    } else {
      if (e.key === 'Enter') { e.preventDefault(); commit(); return; }
      if (e.key === 'Backspace' && !title) { e.preventDefault(); setStep(0); setKind(null); return; }
    }
  }

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
              <span className="cmdk-prefix" style={{ color: window.NotesData.KIND_COLORS[kind.kindKey] }}>
                + {kind.label.toUpperCase()}
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
            {initialText ? (
              <div className="cmdk-section-label">From selection: "{initialText.slice(0, 60)}"</div>
            ) : (
              <div className="cmdk-section-label">Pick a type</div>
            )}
            <div className="cmdk-list">
              {filtered.length === 0 ? (
                <div className="cmdk-empty">No matching kinds</div>
              ) : filtered.map((k, i) => (
                <div
                  key={k.id}
                  className={`cmdk-row${i === selected ? ' is-selected' : ''}`}
                  style={{ '--kind-color': window.NotesData.KIND_COLORS[k.kindKey] }}
                  onMouseEnter={() => setSelected(i)}
                  onMouseDown={(e) => { e.preventDefault(); pickKind(k); }}
                >
                  <span className="cmdk-row-pip" />
                  <div className="cmdk-row-main">
                    <div className="cmdk-row-action">New <b>{k.label}</b></div>
                    <div className="cmdk-row-meta">{k.desc}</div>
                  </div>
                  <span className="cmdk-row-kbd">{k.kbd}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <div className="cmdk-list">
            <div className="cmdk-section-label">Will be created at</div>
            <div className="cmdk-row" style={{ '--kind-color': window.NotesData.KIND_COLORS[kind.kindKey], cursor: 'default' }}>
              <span className="cmdk-row-pip" />
              <div className="cmdk-row-main">
                <div className="cmdk-row-action">{kind.id}/<b>{slugify(title) || '…'}</b>.md</div>
                <div className="cmdk-row-meta">A new {kind.label.toLowerCase()} will open in a tab</div>
              </div>
            </div>
          </div>
        )}

        <div className="cmdk-footer">
          {step === 0 ? (
            <>
              <span><kbd>↑↓</kbd>navigate</span>
              <span><kbd>↵</kbd>select</span>
              <span><kbd>1–7</kbd>quick-pick</span>
              <span><kbd>esc</kbd>close</span>
            </>
          ) : (
            <>
              <span><kbd>↵</kbd>create &amp; open</span>
              <span><kbd>⌫</kbd>back</span>
              <span><kbd>esc</kbd>close</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function slugify(s) {
  return s.toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

window.QuickAddPalette = QuickAddPalette;
window.slugifyNote = slugify;
