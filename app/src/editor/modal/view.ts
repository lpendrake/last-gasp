import { formatDraftTime, type DraftBuffer } from '../drafts.ts';

export type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; filename: string };

export const COLOR_PRESETS = [
  { label: 'Default (weekday)', value: '' },
  { label: '■ Crimson',  value: '#a83030' },
  { label: '■ Amber',    value: '#b87030' },
  { label: '■ Gold',     value: '#c09820' },
  { label: '■ Forest',   value: '#3d7a38' },
  { label: '■ Teal',     value: '#287868' },
  { label: '■ Blue',     value: '#2858a0' },
  { label: '■ Indigo',   value: '#483898' },
  { label: '■ Violet',   value: '#783888' },
  { label: '■ Rose',     value: '#a03068' },
  { label: '■ Slate',    value: '#505870' },
  { label: 'Custom…',    value: '__custom__' },
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;'  :
    c === '>' ? '&gt;'  :
    c === '"' ? '&quot;' : '&#39;'
  );
}

export function editorHtml(mode: Mode): string {
  const titleText = mode.kind === 'create' ? 'New event' : `Edit: ${escapeHtml(mode.filename)}`;
  const deleteBtn = mode.kind === 'edit'
    ? `<button type="button" class="editor-btn editor-btn-danger editor-delete">Delete</button>`
    : '';
  return `
    <div class="editor-header">
      <h2 class="editor-title-bar">${titleText}</h2>
      <div class="editor-status"></div>
      <button type="button" class="editor-close" aria-label="Close">×</button>
    </div>
    <div class="editor-error" hidden>
      <span class="editor-error-icon">⚠</span>
      <span class="editor-error-message"></span>
      <button type="button" class="editor-btn editor-retry">Retry</button>
    </div>
    <div class="editor-body">
      <div class="editor-fields">
        <label class="editor-label">Title
          <input type="text" name="title" class="editor-input" autocomplete="off">
        </label>
        <label class="editor-label">Date (Golarian ISO)
          <input type="text" name="date" class="editor-input" placeholder="4726-05-04T09:30" autocomplete="off">
        </label>
        <label class="editor-label">Tags (comma-separated)
          <input type="text" name="tags" class="editor-input" placeholder="plot:beast, location:fort, session:2026-04-22" autocomplete="off">
        </label>
        <label class="editor-label">Colour
          <span class="editor-color-row">
            <select name="color-preset" class="editor-input editor-color-preset">
              ${COLOR_PRESETS.map(p => `<option value="${escapeHtml(p.value)}">${escapeHtml(p.label)}</option>`).join('')}
            </select>
            <input type="text" name="color-custom" class="editor-input editor-color-custom" placeholder="#c43" autocomplete="off" hidden>
            <span class="editor-color-swatch"></span>
          </span>
        </label>
        <label class="editor-label editor-label-body">Body (markdown)
          <textarea name="body" class="editor-input editor-textarea" spellcheck="false"></textarea>
        </label>
      </div>
      <div class="editor-preview-column">
        <div class="editor-preview-header">Preview</div>
        <div class="editor-preview markdown-body"></div>
      </div>
    </div>
    <div class="editor-footer">
      <div class="editor-footer-left">
        ${deleteBtn}
      </div>
      <div class="editor-footer-right">
        <button type="button" class="editor-btn editor-discard">Discard</button>
        <button type="button" class="editor-btn editor-btn-primary editor-save" disabled>Save</button>
      </div>
    </div>
  `;
}

/** "Restore unsaved draft?" prompt shown before the editor opens. */
export function promptRestoreDraft(savedAt: string): Promise<'restore' | 'discard' | 'cancel'> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay restore-overlay';
    const panel = document.createElement('div');
    panel.className = 'restore-panel';
    const hhmm = formatDraftTime({ buffer: {} as DraftBuffer, savedAt, baseMtime: null });
    panel.innerHTML = `
      <h2 class="restore-title">Restore unsaved draft?</h2>
      <p class="restore-message">A draft was saved locally at <strong>${hhmm || savedAt}</strong>. Restore it into the editor?</p>
      <div class="restore-buttons">
        <button type="button" class="editor-btn restore-discard">Discard draft</button>
        <button type="button" class="editor-btn restore-cancel">Ignore (use file)</button>
        <button type="button" class="editor-btn editor-btn-primary restore-yes">Restore</button>
      </div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    const done = (choice: 'restore' | 'discard' | 'cancel') => {
      overlay.remove();
      resolve(choice);
    };
    (panel.querySelector('.restore-yes')      as HTMLButtonElement).addEventListener('click', () => done('restore'));
    (panel.querySelector('.restore-discard')  as HTMLButtonElement).addEventListener('click', () => done('discard'));
    (panel.querySelector('.restore-cancel')   as HTMLButtonElement).addEventListener('click', () => done('cancel'));
  });
}
