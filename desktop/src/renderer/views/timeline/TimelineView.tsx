import React, { useState } from 'react';
import { FooterPortal } from '../../components/FooterPortal';

export function TimelineView() {
  const [highlighted, setHighlighted] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: highlighted ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        transition: 'background-color 0.3s',
      }}
    >
      <h1
        style={{
          color: highlighted ? '#818cf8' : '#fff',
          transition: 'color 0.2s',
          fontSize: '48px',
          fontWeight: 800,
        }}
      >
        Timeline
      </h1>
      <p style={{ color: '#888' }}>Future home of the Timeline interface.</p>

      <FooterPortal>
        <button
          onClick={() => setHighlighted(!highlighted)}
          style={{
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#818cf8',
            border: '1px solid #6366f1',
            padding: '6px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Highlight Timeline
        </button>
      </FooterPortal>
    </div>
  );
}
