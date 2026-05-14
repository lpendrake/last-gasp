import React, { useState } from 'react';

export type ViewType = 'notes' | 'timeline' | 'relationships';

interface FooterProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
  onBackToCampaigns: () => void;
}

export function Footer({ currentView, onChangeView, onBackToCampaigns }: FooterProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const viewNames: Record<ViewType, string> = {
    notes: 'Notes',
    timeline: 'Timeline',
    relationships: 'Relationships',
  };

  return (
    <div
      style={{
        height: '50px',
        backgroundColor: '#18181b',
        borderTop: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        position: 'relative',
      }}
    >
      {/* Burger & View Switcher */}
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          padding: '6px 12px',
          borderRadius: '6px',
          backgroundColor: menuOpen ? '#27272a' : 'transparent',
          color: '#e0e0e0',
          transition: 'background 0.2s',
          position: 'relative',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
        onMouseOut={(e) => {
          if (!menuOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ fontSize: '18px' }}>☰</div>
        <div style={{ fontWeight: 600, fontSize: '14px', minWidth: '80px' }}>
          {viewNames[currentView]}
        </div>
      </div>

      {/* View Selection Menu */}
      {menuOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              left: '20px',
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 10,
              width: '200px',
            }}
          >
            {(Object.keys(viewNames) as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  onChangeView(v);
                  setMenuOpen(false);
                }}
                style={{
                  background: currentView === v ? '#27272a' : 'transparent',
                  color: currentView === v ? '#fff' : '#a1a1aa',
                  border: 'none',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  transition: 'background 0.1s',
                }}
                onMouseOver={(e) => {
                  if (currentView !== v) e.currentTarget.style.background = '#1f1f22';
                }}
                onMouseOut={(e) => {
                  if (currentView !== v) e.currentTarget.style.background = 'transparent';
                }}
              >
                {viewNames[v]}
              </button>
            ))}

            <div style={{ height: '1px', backgroundColor: '#27272a', margin: '4px 8px' }} />

            <button
              onClick={() => {
                onBackToCampaigns();
                setMenuOpen(false);
              }}
              style={{
                background: 'transparent',
                color: '#71717a',
                border: 'none',
                padding: '10px 12px',
                borderRadius: '4px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#1f1f22';
                e.currentTarget.style.color = '#e0e0e0';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#71717a';
              }}
            >
              ← Back to Campaigns
            </button>
          </div>
        </>
      )}

      {/* Dynamic Content Portal Target */}
      <div
        id="footer-portal-target"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingLeft: '20px',
          gap: '10px',
        }}
      ></div>
    </div>
  );
}
