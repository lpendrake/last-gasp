import { useState } from 'react';

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
        backgroundColor: 'var(--theme-panel, #2d3d2a)',
        borderTop: '1px solid var(--theme-border, #3a3a30)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        position: 'relative',
        gap: '0',
      }}
    >
      {/* Burger & View Switcher */}
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          padding: '6px 12px',
          borderRadius: '4px',
          backgroundColor: menuOpen ? 'var(--theme-panel-accent, #3a4d35)' : 'transparent',
          color: 'var(--theme-text-primary, #d8d0b8)',
          transition: 'background 0.2s',
          position: 'relative',
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.backgroundColor = 'var(--theme-panel-accent, #3a4d35)')
        }
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
              backgroundColor: 'var(--theme-surface, #242420)',
              border: '1px solid var(--theme-border-strong, #5a4530)',
              borderRadius: '4px',
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
                  background:
                    currentView === v ? 'var(--theme-panel-accent, #3a4d35)' : 'transparent',
                  color:
                    currentView === v
                      ? 'var(--theme-accent-gold, #c9a860)'
                      : 'var(--theme-text-primary, #d8d0b8)',
                  border: 'none',
                  padding: '10px 12px',
                  borderRadius: '2px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  transition: 'background 0.1s',
                }}
                onMouseOver={(e) => {
                  if (currentView !== v)
                    e.currentTarget.style.background = 'var(--theme-panel, #2d3d2a)';
                }}
                onMouseOut={(e) => {
                  if (currentView !== v) e.currentTarget.style.background = 'transparent';
                }}
              >
                {viewNames[v]}
              </button>
            ))}

            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--theme-border, #3a3a30)',
                margin: '4px 8px',
              }}
            />

            <button
              onClick={() => {
                onBackToCampaigns();
                setMenuOpen(false);
              }}
              style={{
                background: 'transparent',
                color: 'var(--theme-text-muted, #7a6f58)',
                border: 'none',
                padding: '10px 12px',
                borderRadius: '2px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--theme-panel, #2d3d2a)';
                e.currentTarget.style.color = 'var(--theme-text-primary, #d8d0b8)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--theme-text-muted, #7a6f58)';
              }}
            >
              ← Back to Campaigns
            </button>
          </div>
        </>
      )}

      {/* Three-slot portal grid — fills remaining footer width */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          columnGap: '8px',
          alignItems: 'center',
          paddingLeft: '12px',
        }}
      >
        <div
          id="footer-slot-left"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        />
        <div
          id="footer-slot-center"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
        />
        <div
          id="footer-slot-right"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'flex-start',
          }}
        />
      </div>
    </div>
  );
}
