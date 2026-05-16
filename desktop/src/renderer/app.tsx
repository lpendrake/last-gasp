import { useCallback, useEffect, useState } from 'react';
import { Footer, ViewType } from './components/footer';
import { NotesView } from './views/notes/notes-view';
import { TimelineView } from './views/timeline/timeline-view';
import { RelationshipsView } from './views/relationships/relationships-view';
import { DirectoryPicker } from './views/setup/directory-picker';
import { CampaignManager } from './views/campaigns/campaign-manager';
import { useCampaigns } from './hooks/useCampaigns';
import { useCampaignPalette } from './hooks/useCampaignPalette';
import { paletteToCssVars } from './timeline/palette';
import { SearchOverlay } from './components/search-overlay';
import type { EventListItem } from './timeline/data/types';
import '../../src/index.css';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('notes');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingJumpFilename, setPendingJumpFilename] = useState<string | null>(null);
  const [pendingOpenNotePath, setPendingOpenNotePath] = useState<string | null>(null);
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

  const palette = useCampaignPalette(activeCampaign?.path ?? null);
  const paletteVars = palette ? paletteToCssVars(palette) : null;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && activeCampaign) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCampaign]);

  const handleJumpToEvent = useCallback((ev: EventListItem) => {
    setCurrentView('timeline');
    setPendingJumpFilename(ev.filename);
  }, []);

  const handleOpenNote = useCallback((absolutePath: string) => {
    setCurrentView('notes');
    setPendingOpenNotePath(absolutePath);
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          backgroundColor: '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#71717a',
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
          />
        );
      case 'timeline':
        return (
          <TimelineView
            campaignPath={activeCampaign.path}
            palette={palette}
            pendingJumpFilename={pendingJumpFilename}
            onJumpHandled={() => setPendingJumpFilename(null)}
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
          />
        );
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: 'var(--theme-background, #09090b)',
        color: 'var(--theme-text-primary, #d8d0b8)',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...(paletteVars ?? {}),
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
