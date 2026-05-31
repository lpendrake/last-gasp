import { useState } from 'react';

export type ViewType = 'notes' | 'timeline' | 'relationships';

interface FooterProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
  onBackToCampaigns: () => void;
  onOpenSettings: () => void;
  settingsOpen: boolean;
}

export function Footer({
  currentView,
  onChangeView,
  onBackToCampaigns,
  onOpenSettings,
  settingsOpen,
}: FooterProps) {
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
        backgroundColor: 'var(--theme-panel)',
        borderTop: '1px solid var(--theme-border)',
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
          backgroundColor: menuOpen ? 'var(--theme-panel-accent)' : 'transparent',
          color: 'var(--theme-text-primary)',
          transition: 'background 0.2s',
          position: 'relative',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--theme-panel-accent)')}
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
              backgroundColor: 'var(--theme-surface)',
              border: '1px solid var(--theme-border-strong)',
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
                  background: currentView === v ? 'var(--theme-panel-accent)' : 'transparent',
                  color:
                    currentView === v ? 'var(--theme-accent-gold)' : 'var(--theme-text-primary)',
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
                  if (currentView !== v) e.currentTarget.style.background = 'var(--theme-panel)';
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
                backgroundColor: 'var(--theme-border)',
                margin: '4px 8px',
              }}
            />

            <button
              onClick={() => {
                onOpenSettings();
                setMenuOpen(false);
              }}
              style={{
                background: 'transparent',
                color: 'var(--theme-text-primary)',
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
                e.currentTarget.style.background = 'var(--theme-panel)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ⚙ Settings
            </button>

            <button
              onClick={() => {
                onBackToCampaigns();
                setMenuOpen(false);
              }}
              style={{
                background: 'transparent',
                color: 'var(--theme-text-muted)',
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
                e.currentTarget.style.background = 'var(--theme-panel)';
                e.currentTarget.style.color = 'var(--theme-text-primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--theme-text-muted)';
              }}
            >
              ← Back to Campaigns
            </button>
          </div>
        </>
      )}

      {/* Far-left portal slot — directly to the right of the view menu */}
      <div
        id="footer-slot-far-left"
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
      />

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

      {/* Settings masking bar — covers burger menu and view buttons when settings modal is open */}
      {settingsOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'var(--theme-panel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 20px',
            zIndex: 1,
          }}
        >
          <div
            id="footer-slot-settings"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          />
        </div>
      )}
    </div>
  );
}
