import React, { useState } from 'react';
import { Footer, ViewType } from './components/Footer';
import { NotesView } from './views/notes/NotesView';
import { TimelineView } from './views/timeline/TimelineView';
import { RelationshipsView } from './views/relationships/RelationshipsView';
import { DirectoryPicker } from './views/setup/DirectoryPicker';
import { CampaignManager } from './views/campaigns/CampaignManager';
import { useCampaigns } from './hooks/useCampaigns';
import '../../src/index.css';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('notes');
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
        return <NotesView campaignPath={activeCampaign.path} campaignId={activeCampaign.id} />;
      case 'timeline':
        return <TimelineView campaignPath={activeCampaign.path} />;
      case 'relationships':
        return <RelationshipsView />;
      default:
        return <NotesView campaignPath={activeCampaign.path} campaignId={activeCampaign.id} />;
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
    </div>
  );
}
