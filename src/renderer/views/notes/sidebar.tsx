import { FileEntry } from '../../hooks/useFiles';
import { ThemeProvider } from '../../theme';

interface SidebarProps {
  files: FileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateNew: () => void;
}

export function Sidebar({ files, activeFile, onSelectFile, onCreateNew }: SidebarProps) {
  const bs = ThemeProvider.get().bootstrap;

  return (
    <div
      style={{
        width: '280px',
        backgroundColor: bs.cardBg,
        borderRight: `1px solid ${bs.cardBorder}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
      }}
    >
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 10px 0', color: bs.text }}>Campaign Notes</h2>
        <button
          onClick={onCreateNew}
          style={{
            width: '100%',
            background: bs.hoverBorder,
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = bs.dimLabel)}
          onMouseOut={(e) => (e.currentTarget.style.background = bs.hoverBorder)}
        >
          + New Note
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {files.map((file) => (
          <div
            key={file.path}
            onClick={() => onSelectFile(file.path)}
            style={{
              padding: '12px 20px',
              cursor: 'pointer',
              backgroundColor: activeFile === file.path ? bs.cardBorder : 'transparent',
              borderLeft:
                activeFile === file.path ? `3px solid ${bs.primary}` : '3px solid transparent',
              color: activeFile === file.path ? bs.text : bs.textMuted,
              transition: 'all 0.1s',
            }}
            onMouseOver={(e) => {
              if (activeFile !== file.path) e.currentTarget.style.backgroundColor = bs.cardBg;
            }}
            onMouseOut={(e) => {
              if (activeFile !== file.path) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {file.name}
          </div>
        ))}
        {files.length === 0 && (
          <div
            style={{ padding: '0 20px', color: bs.textDim, fontSize: '14px', fontStyle: 'italic' }}
          >
            No markdown files found.
          </div>
        )}
      </div>
    </div>
  );
}
