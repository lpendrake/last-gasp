import { FileEntry } from '../hooks/useFiles';

interface EditorProps {
  activeFile: string | null;
  files: FileEntry[];
  content: string;
  isLoading: boolean;
  onAddLine: () => void;
  onDelete: () => void;
}

export function Editor({
  activeFile,
  files,
  content,
  isLoading,
  onAddLine,
  onDelete,
}: EditorProps) {
  if (!activeFile) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#71717a',
        }}
      >
        Select a file from the sidebar to view its contents.
      </div>
    );
  }

  const activeFileName = files.find((f) => f.path === activeFile)?.name || 'Unknown File';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '30px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '12px',
          padding: '30px',
          border: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>{activeFileName}</h1>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onAddLine}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Add Line
            </button>
            <button
              onClick={onDelete}
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: '#000',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #27272a',
            overflowY: 'auto',
          }}
        >
          {isLoading ? (
            <div style={{ color: '#71717a' }}>Loading content...</div>
          ) : (
            <pre
              style={{
                margin: 0,
                fontFamily: '"Fira Code", "Consolas", monospace',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                color: '#d4d4d8',
              }}
            >
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
