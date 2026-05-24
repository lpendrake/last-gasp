import { useState } from 'react';
import { FooterPortal } from '../../components/footer-portal';
import { ThemeProvider } from '../../theme';

export function RelationshipsView() {
  const bs = ThemeProvider.get().bootstrap;
  const [nodesExpanded, setNodesExpanded] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1 style={{ color: bs.text, fontSize: '48px', fontWeight: 800 }}>Relationships</h1>
      <p style={{ color: bs.textDim, marginBottom: '40px' }}>Mind-map of connections.</p>

      <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
        <div
          style={{
            backgroundColor: bs.cardBorder,
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: bs.text,
            fontWeight: 600,
            border: `2px solid ${bs.hoverBorder}`,
          }}
        >
          Entity A
        </div>

        {nodesExpanded && (
          <>
            <div style={{ width: '60px', height: '2px', backgroundColor: bs.successLight }} />
            <div
              style={{
                backgroundColor: `${bs.success}1a`,
                borderRadius: '50%',
                width: '120px',
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: bs.successLight,
                fontWeight: 600,
                border: `2px solid ${bs.success}`,
              }}
            >
              Entity B
            </div>
          </>
        )}
      </div>

      <FooterPortal slot="right">
        <button
          onClick={() => setNodesExpanded(!nodesExpanded)}
          style={{
            background: `${bs.success}1a`,
            color: bs.successLight,
            border: `1px solid ${bs.success}`,
            padding: '6px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          {nodesExpanded ? 'Collapse Connection' : 'Expand Connection'}
        </button>
      </FooterPortal>
    </div>
  );
}
