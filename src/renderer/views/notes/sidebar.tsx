import { FileEntry } from '../../hooks/useFiles';

interface SidebarProps {
  files: FileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateNew: () => void;
}

export function Sidebar({ files, activeFile, onSelectFile, onCreateNew }: SidebarProps) {
  return (
    <div
      style={{
        width: '280px',
        backgroundColor: '#18181b',
        borderRight: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
      }}
    >
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 10px 0', color: '#fff' }}>Campaign Notes</h2>
        <button
          onClick={onCreateNew}
          style={{
            width: '100%',
            background: '#3f3f46',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#52525b')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#3f3f46')}
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
              backgroundColor: activeFile === file.path ? '#27272a' : 'transparent',
              borderLeft: activeFile === file.path ? '3px solid #6366f1' : '3px solid transparent',
              color: activeFile === file.path ? '#fff' : '#a1a1aa',
              transition: 'all 0.1s',
            }}
            onMouseOver={(e) => {
              if (activeFile !== file.path) e.currentTarget.style.backgroundColor = '#1f1f22';
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
            style={{ padding: '0 20px', color: '#71717a', fontSize: '14px', fontStyle: 'italic' }}
          >
            No markdown files found.
          </div>
        )}
      </div>
    </div>
  );
}
