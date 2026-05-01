import MarkdownIt from 'markdown-it';
import { getEvent } from '../data/http/events.http.ts';

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export type ConflictChoice = 'overwrite' | 'cancel';

/**
 * Show the conflict modal described in §4.5.4. The user has three intents:
 *   - "View current" — display the on-disk version read-only (stays open).
 *   - "Overwrite"    — resolve(overwrite), caller re-saves with the new mtime.
 *   - "Cancel"       — resolve(cancel), caller leaves the editor open with the buffer intact.
 *
 * Returns a promise that resolves with the user's final decision. "View current"
 * does NOT resolve the promise — it toggles an inline preview panel.
 */
export function showConflictModal(filename: string): Promise<ConflictChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay conflict-overlay';

    const panel = document.createElement('div');
    panel.className = 'conflict-panel';
    panel.innerHTML = `
      <div class="conflict-header">
        <div class="conflict-icon">⚠</div>
        <h2 class="conflict-title">File changed while you were editing it</h2>
      </div>
      <p class="conflict-message">
        <code>${escapeHtml(filename)}</code> was modified on disk since you opened the editor.
        Your unsaved changes are safe and still in the editor. Pick how to resolve:
      </p>
      <div class="conflict-preview" hidden></div>
      <div class="conflict-buttons">
        <button type="button" class="conflict-btn conflict-btn-view">View current on-disk</button>
        <button type="button" class="conflict-btn conflict-btn-cancel">Cancel (keep editing)</button>
        <button type="button" class="conflict-btn conflict-btn-overwrite">Overwrite with my version</button>
      </div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const viewBtn = panel.querySelector('.conflict-btn-view') as HTMLButtonElement;
    const cancelBtn = panel.querySelector('.conflict-btn-cancel') as HTMLButtonElement;
    const overwriteBtn = panel.querySelector('.conflict-btn-overwrite') as HTMLButtonElement;
    const preview = panel.querySelector('.conflict-preview') as HTMLDivElement;

    const done = (choice: ConflictChoice) => {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(choice);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); done('cancel'); }
    };
    window.addEventListener('keydown', onKey);

    cancelBtn.addEventListener('click', () => done('cancel'));
    overwriteBtn.addEventListener('click', () => done('overwrite'));

    viewBtn.addEventListener('click', async () => {
      if (!preview.hidden) {
        preview.hidden = true;
        viewBtn.textContent = 'View current on-disk';
        return;
      }
      viewBtn.disabled = true;
      viewBtn.textContent = 'Loading…';
      try {
        const ev = await getEvent(filename);
        preview.innerHTML = `
          <div class="conflict-preview-meta">
            <strong>${escapeHtml(ev.title)}</strong>
            <span class="conflict-preview-date">${escapeHtml(ev.date)}</span>
          </div>
          <div class="conflict-preview-tags">${
            (ev.tags ?? []).map(t => `<span class="conflict-preview-tag">${escapeHtml(t)}</span>`).join('')
          }</div>
          <div class="conflict-preview-body markdown-body">${md.render(ev.body ?? '')}</div>
        `;
        preview.hidden = false;
        viewBtn.textContent = 'Hide current on-disk';
      } catch (err: any) {
        preview.innerHTML = `<div class="conflict-preview-error">Failed to load: ${escapeHtml(String(err?.message ?? err))}</div>`;
        preview.hidden = false;
      } finally {
        viewBtn.disabled = false;
      }
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;'  :
    c === '>' ? '&gt;'  :
    c === '"' ? '&quot;' : '&#39;'
  );
}
