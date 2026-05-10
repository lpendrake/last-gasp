import React, { useState } from 'react';
import { Campaign } from '../../types/global';

interface CampaignManagerProps {
  campaigns: Campaign[];
  onOpen: (campaign: Campaign) => void;
  onCreate: (name: string, description: string) => Promise<{ success: boolean; error?: string }>;
  onChangeDir: () => void;
  rootDir: string;
}

export function CampaignManager({
  campaigns,
  onOpen,
  onCreate,
  onChangeDir,
  rootDir,
}: CampaignManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const result = await onCreate(newName, newDesc);
    if (result.success) {
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
    } else {
      alert(result.error);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: '#09090b',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '24px 40px',
          borderBottom: '1px solid #18181b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>My Campaigns</h1>
          <div style={{ fontSize: '13px', color: '#71717a', marginTop: '4px' }}>
            Workspace: <span style={{ color: '#a1a1aa' }}>{rootDir}</span>
          </div>
        </div>
        <button
          onClick={onChangeDir}
          style={{
            background: 'transparent',
            border: '1px solid #27272a',
            color: '#a1a1aa',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = '#3f3f46')}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = '#27272a')}
        >
          Change Directory
        </button>
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: '40px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
          alignContent: 'start',
        }}
      >
        {/* Create Card */}
        <div
          onClick={() => !isCreating && setIsCreating(true)}
          style={{
            backgroundColor: isCreating ? '#18181b' : 'transparent',
            border: isCreating ? '1px solid #27272a' : '2px dashed #27272a',
            borderRadius: '16px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '200px',
            cursor: isCreating ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            if (!isCreating) {
              e.currentTarget.style.borderColor = '#3f3f46';
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
            }
          }}
          onMouseOut={(e) => {
            if (!isCreating) {
              e.currentTarget.style.borderColor = '#27272a';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {!isCreating ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
              <div style={{ fontWeight: 600, color: '#e0e0e0' }}>Start New Campaign</div>
              <div style={{ fontSize: '13px', color: '#71717a', marginTop: '4px' }}>
                Create a fresh story world
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>New Campaign</h3>
              <input
                autoFocus
                placeholder="Campaign Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{
                  width: '100%',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  color: '#fff',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '14px',
                }}
              />
              <textarea
                placeholder="Brief description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{
                  width: '100%',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  color: '#fff',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  height: '80px',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreating(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#a1a1aa',
                    border: 'none',
                    padding: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Existing Campaigns */}
        {campaigns.map((campaign) => (
          <div
            key={campaign.path}
            onClick={() => onOpen(campaign)}
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '200px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#3f3f46';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#27272a';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>📜</div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>
                {campaign.name}
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  color: '#a1a1aa',
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {campaign.description || 'No description provided.'}
              </p>
            </div>
            <div style={{ fontSize: '11px', color: '#3f3f46', fontFamily: 'monospace' }}>
              /{campaign.folderName}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
