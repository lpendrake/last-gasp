import { useState, useEffect } from 'react';
import { Campaign } from '../../../types/global';
import { ThemeProvider } from '../../theme';
import { useConfirm } from '../../shared/confirm-dialog/confirm-provider';
import tttIconUrl from '../../../assets/images/TTT.svg';

interface CampaignManagerProps {
  campaigns: Campaign[];
  onOpen: (campaign: Campaign) => void;
  onCreate: (name: string, description: string) => Promise<{ success: boolean; error?: string }>;
  onChangeDir: () => void;
  rootDir: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function CampaignManager({
  campaigns,
  onOpen,
  onCreate,
  onChangeDir,
  rootDir,
}: CampaignManagerProps) {
  const bs = ThemeProvider.get().bootstrap;
  const { alert } = useConfirm();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string } | null>(
    null,
  );
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    window.fsApi.getAppVersion().then(setAppVersion);

    const unsub = window.fsApi.onUpdateAvailable((info) => {
      setUpdateInfo(info);
    });
    return unsub;
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const result = await onCreate(newName, newDesc);
    if (result.success) {
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
    } else {
      await alert({
        title: 'Unable to create campaign',
        message: result.error ?? 'Failed to create campaign.',
      });
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await window.fsApi.installUpdate();
    } catch {
      setInstalling(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: bs.bg,
        color: bs.text,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Update modal */}
      {showUpdateModal && updateInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUpdateModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: bs.cardBg,
              border: `1px solid ${bs.cardBorder}`,
              borderRadius: '16px',
              padding: '32px',
              width: '480px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700 }}>
                Update available
              </h2>
              <div style={{ fontSize: '13px', color: bs.textDim }}>
                v{appVersion} → v{updateInfo.version}
              </div>
            </div>

            {updateInfo.releaseNotes && (
              <div
                style={{
                  background: bs.bg,
                  border: `1px solid ${bs.cardBorder}`,
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '13px',
                  color: bs.textMuted,
                  lineHeight: '1.6',
                  overflowY: 'auto',
                  maxHeight: '300px',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                }}
              >
                {stripHtml(updateInfo.releaseNotes)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUpdateModal(false)}
                disabled={installing}
                style={{
                  background: 'transparent',
                  border: `1px solid ${bs.cardBorder}`,
                  color: bs.textMuted,
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: installing ? 'not-allowed' : 'pointer',
                }}
              >
                Later
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                style={{
                  background: installing ? bs.primaryActive : bs.primary,
                  border: 'none',
                  color: bs.text,
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: installing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {installing ? 'Downloading…' : 'Download & Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          padding: '20px 40px',
          borderBottom: `1px solid ${bs.cardBg}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src={tttIconUrl}
            alt="TableTop Timeline"
            style={{ height: '160px', width: 'auto', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: '60px', fontWeight: 700, lineHeight: 1.2 }}>
              TableTop Timeline
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              {appVersion && (
                <span style={{ fontSize: '20px', color: bs.hoverBorder }}>v{appVersion}</span>
              )}
              {updateInfo && (
                <button
                  onClick={() => setShowUpdateModal(true)}
                  style={{
                    fontSize: '20px',
                    color: bs.warning,
                    background: `${bs.warning}1a`,
                    border: `1px solid ${bs.warning}4d`,
                    borderRadius: '4px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    lineHeight: '1.6',
                  }}
                >
                  Update available
                </button>
              )}
            </div>
            <div style={{ fontSize: '20px', color: bs.dimLabel, marginTop: '3px' }}>
              <span style={{ color: bs.hoverBorder }}>Workspace: </span>
              <span style={{ color: bs.dimLabel }}>{rootDir}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onChangeDir}
          style={{
            background: 'transparent',
            border: `1px solid ${bs.cardBorder}`,
            color: bs.textMuted,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = bs.hoverBorder)}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = bs.cardBorder)}
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
            backgroundColor: isCreating ? bs.cardBg : 'transparent',
            border: isCreating ? `1px solid ${bs.cardBorder}` : `2px dashed ${bs.cardBorder}`,
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
              e.currentTarget.style.borderColor = bs.hoverBorder;
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
            }
          }}
          onMouseOut={(e) => {
            if (!isCreating) {
              e.currentTarget.style.borderColor = bs.cardBorder;
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {!isCreating ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
              <div style={{ fontWeight: 600, color: bs.text }}>Start New Campaign</div>
              <div style={{ fontSize: '13px', color: bs.textDim, marginTop: '4px' }}>
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
                  background: bs.bg,
                  border: `1px solid ${bs.cardBorder}`,
                  color: bs.text,
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
                  background: bs.bg,
                  border: `1px solid ${bs.cardBorder}`,
                  color: bs.text,
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
                    background: bs.primary,
                    color: bs.text,
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
                    color: bs.textMuted,
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
              backgroundColor: bs.cardBg,
              border: `1px solid ${bs.cardBorder}`,
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
              e.currentTarget.style.borderColor = bs.hoverBorder;
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = bs.cardBorder;
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
                  color: bs.textMuted,
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
            <div style={{ fontSize: '11px', color: bs.hoverBorder, fontFamily: 'monospace' }}>
              /{campaign.folderName}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
