/* global React, ReactDOM */
const { useState, useEffect, useMemo, useCallback, useRef } = React;
const AppLiveEditor = window.LiveEditor;
const AppQuickAddPalette = window.QuickAddPalette;
const appSlugify = window.slugifyNote;
const APP_SEED = window.NotesData.SEED;
const APP_FOLDER_KINDS = window.NotesData.FOLDER_KINDS;
const APP_KIND_COLORS = window.NotesData.KIND_COLORS;
const APP_FOLDER_LABELS = window.NotesData.FOLDER_LABELS;
const appBuildLinkIndex = window.NotesData.buildLinkIndex;

// Default Tweaks state — host can rewrite this block
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "renderMode": "live",
  "sidebarWidth": 280
}/*EDITMODE-END*/;

const FOLDER_ORDER = ['npcs', 'locations', 'factions', 'plots', 'rules', 'sessions', 'player-facing', 'misc'];

// REJECTED: titleFromBody was used to show the # heading as tab/sidebar title instead of
// the filename. Laurie explicitly rejected this — files can have multiple headings and the
// filename is always the right label. Always use the filename (without .md) as the display title.
// Do NOT re-implement heading extraction for tab or sidebar labels.
function titleFromBody(_body, fallback) {
  return fallback;
}

function App() {
  // Tweaks
  const tweaks = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const [t, setTweak] = tweaks;

  // ====== File system state ======
  const [files, setFiles] = useState(() => {
    const init = {};
    for (const folder of FOLDER_ORDER) init[folder] = (APP_SEED[folder] || []).map(f => ({ ...f }));
    return init;
  });

  // Open tabs: array of { folder, filename }
  const [tabs, setTabs] = useState([
    { folder: 'npcs', filename: 'aella-stormcaller.md' },
    { folder: 'locations', filename: 'stormhaven.md' },
  ]);
  const [activeTab, setActiveTab] = useState({ folder: 'npcs', filename: 'aella-stormcaller.md' });

  // Sidebar
  const [openFolders, setOpenFolders] = useState({ npcs: true, locations: true, factions: true });
  const [filter, setFilter] = useState('');
  const [creatingIn, setCreatingIn] = useState(null); // folder id

  // Misc UI
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSeed, setQuickAddSeed] = useState('');
  const [quickAddReturn, setQuickAddReturn] = useState(null); // {tab, selStart, selEnd, selText}
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [view, setView] = useState('notes'); // 'notes' | 'timeline' (visual stub)
  const [savingState, setSavingState] = useState({}); // {key: 'dirty'|'saving'|'saved'|'clean'}

  const renderMode = t.renderMode || 'live';

  // ====== Derived ======
  const linkIndex = useMemo(() => appBuildLinkIndex(files), [files]);

  function fileKey(t) { return `${t.folder}/${t.filename}`; }
  function getFile(folder, filename) {
    return (files[folder] || []).find(f => f.name === filename);
  }
  const activeFile = activeTab ? getFile(activeTab.folder, activeTab.filename) : null;

  // ====== File ops ======
  const updateFileBody = useCallback((folder, filename, body) => {
    setFiles(prev => {
      const folderFiles = prev[folder] || [];
      const next = folderFiles.map(f => f.name === filename ? { ...f, body, dirty: true } : f);
      return { ...prev, [folder]: next };
    });
    setSavingState(s => ({ ...s, [`${folder}/${filename}`]: 'dirty' }));
  }, []);

  // Auto-save (mock — debounced)
  useEffect(() => {
    const dirtyKeys = Object.entries(savingState).filter(([, v]) => v === 'dirty').map(([k]) => k);
    if (dirtyKeys.length === 0) return;
    const id = setTimeout(() => {
      // simulate save
      setSavingState(prev => {
        const next = { ...prev };
        for (const k of dirtyKeys) next[k] = 'saving';
        return next;
      });
      setTimeout(() => {
        setSavingState(prev => {
          const next = { ...prev };
          for (const k of dirtyKeys) next[k] = 'saved';
          return next;
        });
        setFiles(prev => {
          const next = { ...prev };
          for (const k of dirtyKeys) {
            const [folder, filename] = k.split('/');
            if (next[folder]) {
              next[folder] = next[folder].map(f => f.name === filename ? { ...f, dirty: false } : f);
            }
          }
          return next;
        });
        // Fade to clean
        setTimeout(() => {
          setSavingState(prev => {
            const next = { ...prev };
            for (const k of dirtyKeys) if (next[k] === 'saved') next[k] = 'clean';
            return next;
          });
        }, 1100);
      }, 250);
    }, 500);
    return () => clearTimeout(id);
  }, [savingState]);

  function createFile({ folder, kind, title }) {
    const slug = appSlugify(title);
    if (!slug) return null;
    const filename = `${slug}.md`;
    if ((files[folder] || []).some(f => f.name === filename)) {
      pushToast(`A note "${filename}" already exists in ${folder}/`);
      return null;
    }
    const body = `# ${title}\n\n`;
    setFiles(prev => ({
      ...prev,
      [folder]: [...(prev[folder] || []), { name: filename, body, dirty: false }],
    }));
    setOpenFolders(prev => ({ ...prev, [folder]: true }));
    return { folder, filename };
  }

  function openFile(folder, filename) {
    const exists = tabs.some(t => t.folder === folder && t.filename === filename);
    if (!exists) setTabs(prev => [...prev, { folder, filename }]);
    setActiveTab({ folder, filename });
  }

  function closeTab(tab) {
    const file = getFile(tab.folder, tab.filename);
    if (file?.dirty) {
      setConfirm({
        title: 'Discard unsaved changes?',
        message: `"${tab.filename}" has unsaved changes.`,
        confirmLabel: 'Discard',
        danger: true,
        onConfirm: () => doCloseTab(tab),
      });
    } else {
      doCloseTab(tab);
    }
  }

  function doCloseTab(tab) {
    const newTabs = tabs.filter(t => !(t.folder === tab.folder && t.filename === tab.filename));
    setTabs(newTabs);
    if (activeTab && activeTab.folder === tab.folder && activeTab.filename === tab.filename) {
      setActiveTab(newTabs[newTabs.length - 1] || null);
    }
  }

  function pushToast(message) {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2400);
  }

  // ====== Quick Add flow ======
  function openQuickAdd(seedText) {
    setQuickAddSeed(seedText || '');
    setQuickAddOpen(true);
  }

  function handleQuickAddCreate({ folder, kind, title }) {
    const created = createFile({ folder, kind, title });
    setQuickAddOpen(false);
    if (!created) return;
    // Open new tab
    setTabs(prev => prev.some(t => t.folder === folder && t.filename === created.filename)
      ? prev : [...prev, created]);
    setActiveTab(created);
    pushToast(`Created ${folder}/${created.filename}`);

    // Auto-link insertion: if we had an active editor selection when triggered,
    // replace that selection with [title](relpath)
    if (quickAddReturn) {
      const { tab, selText, selStart, selEnd } = quickAddReturn;
      const file = (files[tab.folder] || []).find(f => f.name === tab.filename);
      if (file) {
        const href = tab.folder === folder ? created.filename : `../${folder}/${created.filename}`;
        const insertion = `[${title}](${href})`;
        const newBody = file.body.slice(0, selStart) + insertion + file.body.slice(selEnd);
        setFiles(prev => ({
          ...prev,
          [tab.folder]: prev[tab.folder].map(f => f.name === tab.filename ? { ...f, body: newBody, dirty: true } : f),
        }));
        setSavingState(s => ({ ...s, [`${tab.folder}/${tab.filename}`]: 'dirty' }));
      }
      setQuickAddReturn(null);
    }
  }

  // Global hotkey for quick-add (Cmd/Ctrl+Shift+N)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'N' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const sel = window.getSelection();
        const selText = sel ? sel.toString().trim() : '';
        // Capture editor selection offsets for return-link insertion
        if (selText && activeTab) {
          // Read from editor
          const editorRoot = document.querySelector('.live-editor');
          const sourceArea = document.querySelector('.source-editor');
          if (sourceArea && document.activeElement === sourceArea) {
            setQuickAddReturn({ tab: activeTab, selText, selStart: sourceArea.selectionStart, selEnd: sourceArea.selectionEnd });
          } else if (editorRoot) {
            // Estimate offsets in body via textContent
            const body = activeFile?.body || '';
            const idx = body.indexOf(selText);
            if (idx >= 0) {
              setQuickAddReturn({ tab: activeTab, selText, selStart: idx, selEnd: idx + selText.length });
            }
          }
        }
        openQuickAdd(selText);
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openQuickAdd('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, activeFile, files]);

  // ====== Sidebar ======
  function toggleFolder(folder) {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  }

  function startCreateInFolder(folder) {
    setOpenFolders(prev => ({ ...prev, [folder]: true }));
    setCreatingIn(folder);
  }

  function commitNewInFolder(folder, name) {
    const trimmed = name.trim();
    if (!trimmed) { setCreatingIn(null); return; }
    const slug = appSlugify(trimmed);
    const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
    if ((files[folder] || []).some(f => f.name === filename)) {
      pushToast(`Already exists`);
      setCreatingIn(null);
      return;
    }
    setFiles(prev => ({
      ...prev,
      [folder]: [...(prev[folder] || []), { name: filename, body: `# ${trimmed}\n\n`, dirty: false }],
    }));
    openFile(folder, filename);
    setCreatingIn(null);
  }

  // ====== Open link from editor (cmd-click) ======
  function handleOpenLink(href) {
    if (!activeTab) return;
    // Resolve relative to current file's folder
    let folder = activeTab.folder;
    let filename = href;
    let m = /^\.\.\/([^/]+)\/(.+)$/.exec(href);
    if (m) { folder = m[1]; filename = m[2]; }
    else if ((m = /^([^/]+)\/(.+)$/.exec(href))) { folder = m[1]; filename = m[2]; }
    // Normalize: if filename has slashes (e.g. stormhaven/the-spire.md), we'd need nested folders.
    // For this prototype, only support flat folder/file. Otherwise toast.
    if (filename.includes('/')) {
      pushToast(`Nested location: ${folder}/${filename}`);
      return;
    }
    if (!getFile(folder, filename)) {
      pushToast(`Note not found: ${folder}/${filename}`);
      return;
    }
    openFile(folder, filename);
  }

  // ====== Render: Sidebar tree ======
  function renderSidebar() {
    const q = filter.toLowerCase().trim();
    return (
      <aside className="notes-sidebar" style={{ flex: `0 0 ${t.sidebarWidth || 280}px` }}>
        <div className="sidebar-header">
          <div className="sidebar-title">VAULT · last-gasp</div>
          <input
            className="sidebar-filter"
            placeholder="filter notes…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="sidebar-tree">
          {FOLDER_ORDER.map(folder => {
            const folderFiles = files[folder] || [];
            const matched = q
              ? folderFiles.filter(f => f.name.toLowerCase().includes(q) || titleFromBody(f.body, f.name).toLowerCase().includes(q))
              : folderFiles;
            const isOpen = q ? matched.length > 0 : !!openFolders[folder];
            const kind = APP_FOLDER_KINDS[folder];
            return (
              <div key={folder} className="sidebar-folder">
                <button
                  className={`folder-row${isOpen ? ' is-open' : ''}`}
                  onClick={() => toggleFolder(folder)}
                  style={{ '--kind-color': APP_KIND_COLORS[kind] }}
                >
                  <span className="folder-caret">{isOpen ? '▾' : '▸'}</span>
                  <span className="folder-name">{APP_FOLDER_LABELS[folder]}/</span>
                  <span className="folder-count">{folderFiles.length}</span>
                  <span
                    className="folder-add"
                    title={`New in ${folder}/`}
                    onClick={(e) => { e.stopPropagation(); startCreateInFolder(folder); }}
                  >+</span>
                </button>
                {isOpen && (
                  <div className="folder-children">
                    {matched.map(f => {
                      const k = `${folder}/${f.name}`;
                      const isActive = activeTab && activeTab.folder === folder && activeTab.filename === f.name;
                      return (
                        <button
                          key={f.name}
                          className={`file-row${isActive ? ' is-active' : ''}`}
                          style={{ '--kind-color': APP_KIND_COLORS[kind] }}
                          onClick={() => openFile(folder, f.name)}
                        >
                          <span className="file-dot" />
                          <span className="file-name">{titleFromBody(f.body, f.name.replace(/\.md$/, ''))}</span>
                          {f.dirty && <span className="file-dirty">●</span>}
                        </button>
                      );
                    })}
                    {creatingIn === folder && (
                      <div className="new-file-row">
                        <span className="file-dot" style={{ '--kind-color': APP_KIND_COLORS[kind] }} />
                        <input
                          className="new-file-input"
                          autoFocus
                          placeholder="new-note-title"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitNewInFolder(folder, e.target.value);
                            if (e.key === 'Escape') setCreatingIn(null);
                          }}
                          onBlur={(e) => commitNewInFolder(folder, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button className="new-folder-btn" onClick={() => pushToast('New folder — UI mock')}>
            + new folder
          </button>
        </div>
      </aside>
    );
  }

  // ====== Render: Tabs ======
  function renderTabs() {
    if (tabs.length === 0) return null;
    return (
      <div className="tabs-bar">
        {tabs.map(tab => {
          const file = getFile(tab.folder, tab.filename);
          const kind = APP_FOLDER_KINDS[tab.folder];
          const isActive = activeTab && activeTab.folder === tab.folder && activeTab.filename === tab.filename;
          const title = file ? titleFromBody(file.body, tab.filename.replace(/\.md$/, '')) : tab.filename;
          return (
            <div
              key={`${tab.folder}/${tab.filename}`}
              className={`tab${isActive ? ' is-active' : ''}`}
              style={{ '--kind-color': APP_KIND_COLORS[kind] }}
              onClick={() => setActiveTab(tab)}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab); } }}
            >
              <span className="tab-dot" />
              <span className="tab-label">{title}</span>
              {file?.dirty && <span className="tab-dirty">●</span>}
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); closeTab(tab); }}
                title="Close"
              >×</button>
            </div>
          );
        })}
      </div>
    );
  }

  // ====== Render: Breadcrumbs ======
  function renderBreadcrumbs() {
    if (!activeTab) return null;
    const key = fileKey(activeTab);
    const status = savingState[key] || 'clean';
    const statusText = {
      clean: 'saved',
      dirty: 'unsaved',
      saving: 'saving…',
      saved: 'saved ✓',
    }[status];
    return (
      <div className="breadcrumbs">
        <span className="breadcrumb-segment">vault</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-segment">{activeTab.folder}</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-segment is-leaf">{activeTab.filename}</span>
        <span className={`breadcrumb-status is-${status}`}>{statusText}</span>
      </div>
    );
  }

  // ====== Render: Editor surface ======
  function renderEditor() {
    if (!activeTab || !activeFile) {
      return (
        <div className="empty-pane">
          <div className="empty-pane-mark">∅</div>
          <div>No note open</div>
          <div className="empty-pane-hint">
            Pick a note from the sidebar, or hit <kbd>Cmd</kbd>+<kbd>K</kbd> to quick-add a new one.
          </div>
        </div>
      );
    }
    const onChange = (newBody) => updateFileBody(activeTab.folder, activeTab.filename, newBody);
    const linkOpen = handleOpenLink;
    const triggerQA = (selText) => {
      // also remember current selection for auto-link
      const editorEl = document.querySelector('.live-editor');
      const srcEl = document.querySelector('.source-editor');
      if (selText && activeTab) {
        if (srcEl && document.activeElement === srcEl) {
          setQuickAddReturn({ tab: activeTab, selText, selStart: srcEl.selectionStart, selEnd: srcEl.selectionEnd });
        } else if (editorEl) {
          const idx = activeFile.body.indexOf(selText);
          if (idx >= 0) setQuickAddReturn({ tab: activeTab, selText, selStart: idx, selEnd: idx + selText.length });
        }
      }
      openQuickAdd(selText);
    };

    if (renderMode === 'live') {
      return (
        <div className="editor-surface mode-live">
          <div className="editor-pane">
            <AppLiveEditor
              key={fileKey(activeTab) + ':live'}
              value={activeFile.body}
              onChange={onChange}
              currentFolder={activeTab.folder}
              linkIndex={linkIndex}
              onOpenLink={linkOpen}
              onTriggerQuickAdd={triggerQA}
            />
          </div>
        </div>
      );
    }
    if (renderMode === 'source') {
      return (
        <div className="editor-surface mode-source">
          <div className="editor-pane">
            <textarea
              className="source-editor"
              value={activeFile.body}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      );
    }
    // split
    return (
      <div className="editor-surface mode-split">
        <div className="editor-pane">
          <textarea
            className="source-editor"
            value={activeFile.body}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="editor-pane">
          <AppLiveEditor
            key={fileKey(activeTab) + ':split'}
            value={activeFile.body}
            onChange={onChange}
            currentFolder={activeTab.folder}
            linkIndex={linkIndex}
            onOpenLink={linkOpen}
            onTriggerQuickAdd={triggerQA}
          />
        </div>
      </div>
    );
  }

  // ====== Footer (context-sensitive) ======
  function renderFooter() {
    return (
      <footer className="toolbar">
        <div className="toolbar-left">
          <button onClick={() => pushToast('Filters — global')}>Filters</button>
          <button onClick={() => pushToast('Search — reuses global Cmd+F')}>Search</button>
        </div>
        <div className="toolbar-main">
          {view === 'notes' ? (
            <>
              <button
                className="is-kind"
                style={{ '--kind-color': APP_KIND_COLORS.npc }}
                onClick={() => { setQuickAddSeed(''); setQuickAddOpen(true); /* TODO: pre-pick npc */ }}
                title="New NPC"
              ><span className="kind-pip" />+ NPC</button>
              <button
                className="is-kind"
                style={{ '--kind-color': APP_KIND_COLORS.location }}
                onClick={() => setQuickAddOpen(true)}
                title="New Location"
              ><span className="kind-pip" />+ Location</button>
              <button
                className="is-kind"
                style={{ '--kind-color': APP_KIND_COLORS.faction }}
                onClick={() => setQuickAddOpen(true)}
                title="New Faction"
              ><span className="kind-pip" />+ Faction</button>
              <button className="is-primary" onClick={() => openQuickAdd('')} title="Quick add (⌘K / ⌘⇧N)">+ Note</button>
            </>
          ) : (
            <>
              <button>Session</button>
              <button className="is-primary">+ Event</button>
              <button>Now</button>
              <button>Advance Time</button>
            </>
          )}
        </div>
        <div className="toolbar-right">
          {view === 'notes' && (
            <div className="view-switcher" title="Editor render mode">
              <button className={renderMode === 'live' ? 'is-active' : ''} onClick={() => setTweak('renderMode', 'live')} title="Live preview">Live</button>
              <button className={renderMode === 'source' ? 'is-active' : ''} onClick={() => setTweak('renderMode', 'source')} title="Source only">Source</button>
              <button className={renderMode === 'split' ? 'is-active' : ''} onClick={() => setTweak('renderMode', 'split')} title="Split view">Split</button>
            </div>
          )}
          <div className="view-switcher" title="Switch view">
            <button className={view === 'timeline' ? 'is-active' : ''} onClick={() => setView('timeline')}>Timeline</button>
            <button className={view === 'notes' ? 'is-active' : ''} onClick={() => setView('notes')}>Notes</button>
          </div>
        </div>
      </footer>
    );
  }

  // ====== Confirm modal ======
  function renderConfirm() {
    if (!confirm) return null;
    return (
      <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
        <div className="confirm-panel">
          <div className="confirm-title">{confirm.title}</div>
          <div className="confirm-msg">{confirm.message}</div>
          <div className="confirm-actions">
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className={confirm.danger ? 'is-danger' : 'is-primary'}
              onClick={() => { confirm.onConfirm(); setConfirm(null); }}
            >{confirm.confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  // ====== Tweaks panel ======
  function renderTweaks() {
    const TweaksPanel = window.TweaksPanel;
    const TweakSection = window.TweakSection;
    const TweakRadio = window.TweakRadio;
    const TweakSlider = window.TweakSlider;
    if (!TweaksPanel) return null;
    return (
      <TweaksPanel>
        <TweakSection title="Editor render mode">
          <TweakRadio
            value={t.renderMode}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'source', label: 'Source' },
              { value: 'split', label: 'Split' },
            ]}
            onChange={(v) => setTweak('renderMode', v)}
          />
        </TweakSection>
        <TweakSection title="Sidebar width">
          <TweakSlider
            min={220} max={400} step={10}
            value={t.sidebarWidth || 280}
            onChange={(v) => setTweak('sidebarWidth', v)}
          />
        </TweakSection>
      </TweaksPanel>
    );
  }

  // ====== Render ======
  return (
    <>
      {view === 'notes' ? (
        <div className="notes-shell" data-screen-label="Notes view">
          {renderSidebar()}
          <main className="notes-main">
            {renderTabs()}
            {renderBreadcrumbs()}
            {renderEditor()}
          </main>
        </div>
      ) : (
        <div className="notes-shell" data-screen-label="Timeline view (stub)">
          <div className="empty-pane" style={{ flex: 1 }}>
            <div className="empty-pane-mark">⌖</div>
            <div style={{ fontSize: 16, color: 'var(--theme-text-secondary)' }}>Timeline view</div>
            <div className="empty-pane-hint">
              This is the existing timeline. Click <b>Notes</b> in the bottom-right to come back.
            </div>
          </div>
        </div>
      )}
      {renderFooter()}
      <AppQuickAddPalette
        open={quickAddOpen}
        initialText={quickAddSeed}
        onClose={() => { setQuickAddOpen(false); setQuickAddReturn(null); }}
        onCreate={handleQuickAddCreate}
      />
      <div className="toasts">
        {toasts.map(t => <div key={t.id} className="toast">{t.message}</div>)}
      </div>
      {renderConfirm()}
      {renderTweaks()}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
