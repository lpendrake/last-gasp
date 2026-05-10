import React, { useState } from 'react';
import { useFiles } from '../../hooks/useFiles';
import { Sidebar } from './Sidebar';
import { Editor } from '../../components/Editor';
import { FooterPortal } from '../../components/FooterPortal';

export function NotesView({ campaignPath }: { campaignPath: string }) {
  const notesDir = campaignPath.includes('\\') ? `${campaignPath}\\notes` : `${campaignPath}/notes`;
  const {
    files,
    activeFile,
    content,
    isLoading,
    fetchFile,
    handleCreateNew,
    handleAddLine,
    handleDelete,
  } = useFiles(notesDir);

  const [bgColor, setBgColor] = useState('transparent');

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar
        files={files}
        activeFile={activeFile}
        onSelectFile={fetchFile}
        onCreateNew={handleCreateNew}
      />

      {/* Wrap the Editor to apply our dynamic color for the PoC */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          backgroundColor: bgColor,
          transition: 'background-color 0.3s',
        }}
      >
        <Editor
          activeFile={activeFile}
          files={files}
          content={content}
          isLoading={isLoading}
          onAddLine={handleAddLine}
          onDelete={handleDelete}
        />
      </div>

      <FooterPortal>
        <button
          onClick={() =>
            setBgColor((prev) =>
              prev === 'transparent' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
            )
          }
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid #ef4444',
            padding: '6px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Toggle Red Background
        </button>
      </FooterPortal>
    </div>
  );
}
