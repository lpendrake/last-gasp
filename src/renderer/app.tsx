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
import { CampaignSettingsModal } from './views/settings/campaign-settings-modal';
import { CampaignLoadOverlay } from './components/campaign-load-overlay';
import { notesData } from './notes/data';
import { timelinePort } from './timeline/data/ports';
import { initPeek, teardownPeek } from './peek/stack';
import type { EventListItem } from './timeline/data/types';
import type { EntityIndexEntry } from '../types/global';
import {
  buildEntityLabelMap,
  buildEntityTagLabelMap,
  applyEntityDelta,
} from '../shared/entity-labels';
import '../../src/index.css';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('timeline');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingJumpFilename, setPendingJumpFilename] = useState<string | null>(null);
  const [pendingOpenNotePath, setPendingOpenNotePath] = useState<string | null>(null);
  const [pendingNoteMatchOffset, setPendingNoteMatchOffset] = useState<number | null>(null);
  const {
    rootDir,
    campaigns,
    activeCampaign,
    isLoading,
    loadProgress,
    loadResult,
    loadError,
    pendingEntityIndex,
    dismissLoadNotification,
    handleSetRootDir,
    handleCreateCampaign,
    handleOpenCampaign,
    handleCloseCampaign,
  } = useCampaigns();

  const entityIndexRef = useRef<EntityIndexEntry[]>([]);
  const [entityLabelMap, setEntityLabelMap] = useState<Map<string, string>>(new Map());
  const [entityTagLabelMap, setEntityTagLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!activeCampaign) return;
    const campaignPath = activeCampaign.path;

    if (pendingEntityIndex) {
      entityIndexRef.current = pendingEntityIndex;
      setEntityLabelMap(buildEntityLabelMap(pendingEntityIndex));
      setEntityTagLabelMap(buildEntityTagLabelMap(pendingEntityIndex));
      return;
    }

    entityIndexRef.current = [];
    setEntityLabelMap(new Map());
    setEntityTagLabelMap(new Map());
    let active = true;
    notesData
      .getEntityIndex(campaignPath)
      .then((index) => {
        if (active) {
          entityIndexRef.current = index;
          setEntityLabelMap(buildEntityLabelMap(index));
          setEntityTagLabelMap(buildEntityTagLabelMap(index));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      entityIndexRef.current = [];
    };
    // pendingEntityIndex is intentionally omitted from deps: handleOpenCampaign
    // sets it and activeCampaign in the same React batch, so by the time this
    // effect fires on a path change, pendingEntityIndex already reflects the new
    // campaign. Adding it would cause a redundant re-run when it resets to null.
  }, [activeCampaign?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep entityIndexRef and label maps in sync with file system renames/edits.
  useEffect(() => {
    return window.fsApi.onEntityDelta((delta) => {
      const updated = applyEntityDelta(entityIndexRef.current, delta);
      entityIndexRef.current = updated;
      setEntityLabelMap(buildEntityLabelMap(updated));
      setEntityTagLabelMap(buildEntityTagLabelMap(updated));
    });
  }, []); // stable — ref and setters are stable references

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

  // States 2 & 3: share one tree so CampaignLoadOverlay is never remounted
  // between the campaign-list → active-campaign transition.
  const renderMainContent = () => {
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
              entityTagLabelMap={entityTagLabelMap}
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
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>{renderView()}</div>
        <Footer
          currentView={currentView}
          onChangeView={setCurrentView}
          onBackToCampaigns={handleCloseCampaign}
          onOpenSettings={() => setSettingsOpen(true)}
          settingsOpen={settingsOpen}
        />
        <SearchOverlay
          isOpen={isSearchOpen}
          campaignPath={activeCampaign.path}
          onClose={() => setIsSearchOpen(false)}
          onJumpToEvent={handleJumpToEvent}
          onOpenNote={handleOpenNote}
        />
        {settingsOpen && (
          <CampaignSettingsModal
            campaignName={activeCampaign.name}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    );
  };

  return (
    <>
      {renderMainContent()}
      <CampaignLoadOverlay
        result={loadResult}
        progress={loadProgress}
        errorMessage={loadError}
        fileCount={pendingEntityIndex?.length ?? 0}
        onDismissNotification={dismissLoadNotification}
      />
    </>
  );
}
