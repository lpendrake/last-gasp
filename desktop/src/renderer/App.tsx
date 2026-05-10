import React, { useState } from 'react';
import { Footer, ViewType } from './components/Footer';
import { NotesView } from './views/notes/NotesView';
import { TimelineView } from './views/timeline/TimelineView';
import { RelationshipsView } from './views/relationships/RelationshipsView';
import '../../src/index.css';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('notes');

  const renderView = () => {
    switch (currentView) {
      case 'notes':
        return <NotesView />;
      case 'timeline':
        return <TimelineView />;
      case 'relationships':
        return <RelationshipsView />;
      default:
        return <NotesView />;
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: '#121214',
        color: '#e0e0e0',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Main View Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>{renderView()}</div>

      {/* Persistent Footer */}
      <Footer currentView={currentView} onChangeView={setCurrentView} />
    </div>
  );
}
