import { useCallback, useEffect, useState } from 'react';
import type { EntityIndexEntry } from '../../../types/global';
import { entityIndex } from '../entity-index';
import './label-override-editor.css';

interface Props {
  entityId: string;
  target: 'tagLabel' | 'linkLabel';
  onClose: () => void;
}

export function LabelOverrideEditor({ entityId, target, onClose }: Props) {
  const [entry, setEntry] = useState<EntityIndexEntry | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    entityIndex.getAll().then((all) => {
      const found = all.find((e) => e.id === entityId) ?? null;
      setEntry(found);
      if (found) {
        setValue(
          target === 'tagLabel' ? (found.tagLabelOverride ?? '') : (found.linkLabelOverride ?? ''),
        );
      }
    });
  }, [entityId, target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await entityIndex.updateLabelOverride(entityId, target, value.trim() || null);
      onClose();
    } catch (err) {
      console.error('[LabelOverrideEditor] save failed', err);
    } finally {
      setSaving(false);
    }
  }, [entityId, target, value, onClose]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      await entityIndex.updateLabelOverride(entityId, target, null);
      onClose();
    } catch (err) {
      console.error('[LabelOverrideEditor] reset failed', err);
    } finally {
      setSaving(false);
    }
  }, [entityId, target, onClose]);

  const title = target === 'tagLabel' ? 'Edit Tag Label' : 'Edit Link Label';
  const defaultLabel = entry?.title ?? '';

  return (
    <div
      className="label-editor-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="label-editor-modal">
        <button type="button" className="label-editor-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="label-editor-content">
          <h2 className="label-editor-title">{title}</h2>
          <input
            type="text"
            className="label-editor-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) void handleSave();
            }}
            placeholder={defaultLabel}
            autoFocus
          />
          <div className="label-editor-actions">
            <button
              type="button"
              className="label-editor-btn"
              title="Default is the first heading in the note, or the event title"
              onClick={() => void handleReset()}
              disabled={saving}
            >
              Reset to Default
            </button>
            <button type="button" className="label-editor-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="label-editor-btn label-editor-btn--primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
