import { useState } from 'react';
import { FooterPortal } from '../../components/footer-portal';

export function RelationshipsView() {
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
      <h1 style={{ color: '#fff', fontSize: '48px', fontWeight: 800 }}>Relationships</h1>
      <p style={{ color: '#888', marginBottom: '40px' }}>Mind-map of connections.</p>

      <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
        <div
          style={{
            backgroundColor: '#27272a',
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            border: '2px solid #3f3f46',
          }}
        >
          Entity A
        </div>

        {nodesExpanded && (
          <>
            <div style={{ width: '60px', height: '2px', backgroundColor: '#34d399' }} />
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '50%',
                width: '120px',
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                fontWeight: 600,
                border: '2px solid #10b981',
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
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#34d399',
            border: '1px solid #10b981',
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
