import { useCallback, useEffect, useRef, useState } from 'react';
import { Footer, ViewType } from './components/footer';
import { NotesView } from './views/notes/notes-view';
import { TimelineView } from './views/timeline/timeline-view';
import { RelationshipsView } from './views/relationships/relationships-view';
import { DirectoryPicker } from './views/setup/directory-picker';
import { CampaignManager } from './views/campaigns/campaign-manager';
import { useCampaigns } from './hooks/useCampaigns';
import { ThemeProvider } from './theme';
import { SearchOverlay } from './components/search-overlay';
import { notesData } from './notes/data';
import { timelinePort } from './timeline/data/ports';
import { initPeek, teardownPeek } from './peek/stack';
import type { EventListItem } from './timeline/data/types';
import type { EntityIndexEntry } from '../types/global';
import { buildEntityLabelMap } from '../shared/entity-labels';
import '../../src/index.css';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('timeline');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingJumpFilename, setPendingJumpFilename] = useState<string | null>(null);
  const [pendingOpenNotePath, setPendingOpenNotePath] = useState<string | null>(null);
  const [pendingNoteMatchOffset, setPendingNoteMatchOffset] = useState<number | null>(null);
  const {
    rootDir,
    campaigns,
    activeCampaign,
    isLoading,
    handleSetRootDir,
    handleCreateCampaign,
    handleOpenCampaign,
    handleCloseCampaign,
  } = useCampaigns();

  const entityIndexRef = useRef<EntityIndexEntry[]>([]);
  const [entityLabelMap, setEntityLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!activeCampaign) return;
    const campaignPath = activeCampaign.path;
    entityIndexRef.current = [];
    setEntityLabelMap(new Map());
    let active = true;
    notesData
      .getEntityIndex(campaignPath)
      .then((index) => {
        if (active) {
          entityIndexRef.current = index;
          setEntityLabelMap(buildEntityLabelMap(index));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      entityIndexRef.current = [];
    };
  }, [activeCampaign?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep entityIndexRef and entityLabelMap in sync with file system renames/edits.
  // Mirrors the same delta subscription in useNotesController.
  useEffect(() => {
    return window.fsApi.onEntityDelta((delta) => {
      let updated: EntityIndexEntry[];
      if (delta.op === 'add' || delta.op === 'update') {
        const { entry } = delta;
        updated = [
          ...entityIndexRef.current.filter((e) => e.id !== entry.id && e.path !== entry.path),
          entry,
        ];
      } else {
        updated = entityIndexRef.current.filter((e) => e.path !== delta.path);
      }
      entityIndexRef.current = updated;
      setEntityLabelMap(buildEntityLabelMap(updated));
    });
  }, []); // stable — ref and setter are stable references

  useEffect(() => {
    if (!activeCampaign) return;
    const campaignPath = activeCampaign.path;
    initPeek({
      fetcher: async (path, signal) => {
        const content = await notesData.readNote(`${campaignPath}/${path}`);
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (content !== null) return content;
        const filename = path.split('/').pop()!;
        const { event } = await timelinePort.getEvent(campaignPath, filename);
        return `# ${event.title}\n\n${event.body}`;
      },
      getEntityIndex: () => entityIndexRef.current,
      onOpenById: handleOpenById,
    });
    return () => teardownPeek();
  }, [activeCampaign?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && activeCampaign) {
        e.preventDefault();
        e.stopPropagation(); // prevent CM6's searchKeymap from opening its own panel
        setIsSearchOpen(true);
      }
    }
    // Capture phase so we intercept before CM6's bubble-phase keydown handler.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeCampaign]);

  const handleJumpToEvent = useCallback((target: string | EventListItem) => {
    const filename = typeof target === 'string' ? target : target.filename;
    setCurrentView('timeline');
    setPendingJumpFilename(filename);
  }, []);

  const handleOpenNote = useCallback((path: string, matchOffset?: number) => {
    setCurrentView('notes');
    setPendingOpenNotePath(path);
    setPendingNoteMatchOffset(matchOffset ?? null);
  }, []);

  const handleOpenById = useCallback(
    (id: string) => {
      const entry = entityIndexRef.current.find((e) => e.id === id);
      if (!entry) return;
      if (entry.type === 'event') {
        handleJumpToEvent(entry.path.split('/').pop()!);
      } else if (entry.type === 'note') {
        handleOpenNote(entry.path);
      }
    },
    [handleJumpToEvent, handleOpenNote],
  );

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          backgroundColor: ThemeProvider.get().bootstrap.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: ThemeProvider.get().bootstrap.textDim,
        }}
      >
        Loading workspace...
      </div>
    );
  }

  // State 1: Pick Root Directory
  if (!rootDir) {
    return <DirectoryPicker onSelect={handleSetRootDir} />;
  }

  // State 2: Campaign List
  if (!activeCampaign) {
    return (
      <CampaignManager
        campaigns={campaigns}
        onOpen={handleOpenCampaign}
        onCreate={handleCreateCampaign}
        onChangeDir={() => handleSetRootDir('')}
        rootDir={rootDir}
      />
    );
  }

  // State 3: Active Campaign
  const renderView = () => {
    switch (currentView) {
      case 'notes':
        return (
          <NotesView
            campaignPath={activeCampaign.path}
            campaignId={activeCampaign.id}
            pendingOpenNotePath={pendingOpenNotePath}
            onNoteOpenHandled={() => setPendingOpenNotePath(null)}
            pendingNoteMatchOffset={pendingNoteMatchOffset}
            onNoteMatchOffsetHandled={() => setPendingNoteMatchOffset(null)}
            onOpenEvent={handleJumpToEvent}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            campaignPath={activeCampaign.path}
            pendingJumpFilename={pendingJumpFilename}
            onJumpHandled={() => setPendingJumpFilename(null)}
            onOpenById={handleOpenById}
            entityLabelMap={entityLabelMap}
          />
        );
      case 'relationships':
        return <RelationshipsView />;
      default:
        return (
          <NotesView
            campaignPath={activeCampaign.path}
            campaignId={activeCampaign.id}
            pendingOpenNotePath={pendingOpenNotePath}
            onNoteOpenHandled={() => setPendingOpenNotePath(null)}
            pendingNoteMatchOffset={pendingNoteMatchOffset}
            onNoteMatchOffsetHandled={() => setPendingNoteMatchOffset(null)}
            onOpenEvent={handleJumpToEvent}
          />
        );
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: 'var(--theme-background)',
        color: 'var(--theme-text-primary)',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Main View Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>{renderView()}</div>

      {/* Persistent Footer */}
      <Footer
        currentView={currentView}
        onChangeView={setCurrentView}
        onBackToCampaigns={handleCloseCampaign}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        campaignPath={activeCampaign.path}
        onClose={() => setIsSearchOpen(false)}
        onJumpToEvent={handleJumpToEvent}
        onOpenNote={handleOpenNote}
      />
    </div>
  );
}
