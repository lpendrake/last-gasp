import React from 'react';

interface DirectoryPickerProps {
  onSelect: (path: string) => void;
}

export function DirectoryPicker({ onSelect }: DirectoryPickerProps) {
  const handlePick = async () => {
    const path = await window.fsApi.selectDirectory();
    if (path) {
      onSelect(path);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#09090b',
        color: '#fff',
        textAlign: 'center',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <span style={{ fontSize: '32px' }}>📁</span>
      </div>

      <h1
        style={{
          fontSize: '32px',
          fontWeight: 800,
          marginBottom: '16px',
          letterSpacing: '-0.02em',
        }}
      >
        Welcome to TableTop Timeline
      </h1>

      <p
        style={{
          color: '#a1a1aa',
          fontSize: '18px',
          maxWidth: '480px',
          lineHeight: '1.6',
          marginBottom: '40px',
        }}
      >
        To get started, please select a directory where you want to store your campaigns and notes.
      </p>

      <button
        onClick={handlePick}
        style={{
          background: '#6366f1',
          color: 'white',
          border: 'none',
          padding: '16px 32px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(99, 102, 241, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3)';
        }}
      >
        Select Workspace Folder
      </button>

      <div style={{ marginTop: '40px', color: '#3f3f46', fontSize: '14px' }}>
        Tip: We recommend using a folder in your Google Drive or Dropbox.
      </div>
    </div>
  );
}
