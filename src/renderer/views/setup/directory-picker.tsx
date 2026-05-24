import { ThemeProvider } from '../../theme';

interface DirectoryPickerProps {
  onSelect: (path: string) => void;
}

export function DirectoryPicker({ onSelect }: DirectoryPickerProps) {
  const bs = ThemeProvider.get().bootstrap;

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
        backgroundColor: bs.bg,
        color: bs.text,
        textAlign: 'center',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          backgroundColor: `${bs.primary}1a`,
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          border: `1px solid ${bs.primary}33`,
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
          color: bs.textMuted,
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
          background: bs.primary,
          color: bs.text,
          border: 'none',
          padding: '16px 32px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 10px 15px -3px ${bs.primary}4d`,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 20px 25px -5px ${bs.primary}66`;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = `0 10px 15px -3px ${bs.primary}4d`;
        }}
      >
        Select Workspace Folder
      </button>

      <div style={{ marginTop: '40px', color: bs.hoverBorder, fontSize: '14px' }}>
        Tip: We recommend using a folder in your Google Drive or Dropbox.
      </div>
    </div>
  );
}
