import MarkdownIt from 'markdown-it';
import { getEvent } from '../data/api.ts';
import { parseISOString } from '../calendar/golarian.ts';
import { formatExpanded } from '../calendar/format.ts';
import { weekdayColor } from '../theme.ts';
import type { EventListItem } from '../data/types.ts';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

export type EventModalAction = 'close' | 'edit' | 'delete';

/**
 * Open an expanded modal for the given event. Click outside or Esc closes.
 * Returns 'edit'/'delete' when the user chose those actions so the caller
 * can route to the editor or delete flow. Resolves 'close' otherwise.
 */
export async function openEventModal(event: EventListItem): Promise<EventModalAction> {
  const full = await getEvent(event.filename);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'event-modal';
  modal.style.setProperty('--weekday-color', event.color ?? weekdayColor(event.date));

  const header = document.createElement('div');
  header.className = 'event-modal-header-strip';
  modal.appendChild(header);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'event-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  modal.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'event-modal-content';

  const title = document.createElement('h2');
  title.className = 'event-modal-title';
  title.textContent = full.title;
  content.appendChild(title);

  const dateLine = document.createElement('div');
  dateLine.className = 'event-modal-date';
  dateLine.textContent = formatExpanded(parseISOString(full.date));
  content.appendChild(dateLine);

  if (full.tags && full.tags.length > 0) {
    const tagList = document.createElement('div');
    tagList.className = 'event-modal-tags';
    for (const tag of full.tags) {
      const chip = document.createElement('span');
      chip.className = 'event-modal-tag-chip';
      chip.textContent = tag;
      tagList.appendChild(chip);
    }
    content.appendChild(tagList);
  }

  const body = document.createElement('div');
  body.className = 'event-modal-body markdown-body';
  body.innerHTML = md.render(full.body);
  content.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'event-modal-actions';
  actions.innerHTML = `
    <button type="button" class="event-modal-btn event-modal-btn-danger" data-action="delete">Delete</button>
    <button type="button" class="event-modal-btn event-modal-btn-primary" data-action="edit">Edit</button>
  `;
  content.appendChild(actions);

  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  return new Promise<EventModalAction>((resolve) => {
    let resolved = false;
    const close = (action: EventModalAction) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(action);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close('close');
      }
    };
    window.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close('close');
    });
    closeBtn.addEventListener('click', () => close('close'));

    actions.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.action as EventModalAction;
      close(action);
    });
  });
}
