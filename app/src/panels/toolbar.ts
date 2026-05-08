import {
  parseISOString, toISOString, toAbsoluteSeconds, fromAbsoluteSeconds,
} from '../calendar/golarian.ts';
import { formatExpanded } from '../calendar/format.ts';
/** Legacy session shape used only for the toolbar popover form. */
interface LegacySession { real_date: string; in_game_start: string; notes: string; }

function positionAbove(popover: HTMLElement, anchor: HTMLElement) {
  const r = anchor.getBoundingClientRect();
  const popW = parseInt(getComputedStyle(popover).width) || 300;
  let left = r.left;
  if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
  if (left < 12) left = 12;
  popover.style.left = `${left}px`;
  // anchor bottom edge 6px above the button's top edge
  popover.style.bottom = `${window.innerHeight - r.top + 6}px`;
}

function attachOutsideClose(popover: HTMLElement, close: () => void): () => void {
  const handler = (e: MouseEvent) => {
    if (!popover.contains(e.target as Node)) close();
  };
  const id = setTimeout(() => document.addEventListener('mousedown', handler, true), 0);
  return () => { clearTimeout(id); document.removeEventListener('mousedown', handler, true); };
}

function attachEscClose(close: () => void): () => void {
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

function makePopover(wide = false): HTMLDivElement {
  const pop = document.createElement('div');
  pop.className = wide ? 'toolbar-popover is-wide' : 'toolbar-popover';
  document.body.appendChild(pop);
  return pop;
}

function makeCloser(pop: HTMLElement) {
  let closed = false;
  let removeOutside: () => void;
  let removeEsc: () => void;
  const close = () => {
    if (closed) return;
    closed = true;
    pop.remove();
    removeOutside?.();
    removeEsc?.();
  };
  removeOutside = attachOutsideClose(pop, close);
  removeEsc = attachEscClose(close);
  return close;
}

// ---- Advance Time ----

export function openAdvanceTimePopover(
  anchor: HTMLButtonElement,
  currentNow: string,
  onSave: (newNow: string) => void,
) {
  const pop = makePopover();
  positionAbove(pop, anchor);

  const parsed = parseISOString(currentNow);
  const baseSecs = toAbsoluteSeconds(parsed);
  let pendingSecs = baseSecs;

  pop.innerHTML = `
    <div class="popover-title">Advance Time</div>
    <div class="popover-current"></div>
    <div class="popover-quick-row">
      <button data-delta="${3600}">+1 hour</button>
      <button data-delta="${6 * 3600}">+6 hours</button>
      <button data-delta="${86400}">+1 day</button>
      <button data-delta="${7 * 86400}">+1 week</button>
    </div>
    <div class="popover-row">
      <label class="popover-label">Set directly</label>
      <input type="text" class="popover-input" placeholder="4726-05-04T09:30" value="${currentNow}">
    </div>
    <div class="popover-actions">
      <button class="popover-cancel">Cancel</button>
      <button class="popover-save is-primary">Save</button>
    </div>
  `;

  const currentDisplay = pop.querySelector<HTMLElement>('.popover-current')!;
  const dateInput = pop.querySelector<HTMLInputElement>('.popover-input')!;

  function updateDisplay(secs: number) {
    currentDisplay.textContent = formatExpanded(fromAbsoluteSeconds(secs));
  }
  updateDisplay(baseSecs);

  pop.querySelectorAll<HTMLButtonElement>('[data-delta]').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingSecs = baseSecs + parseInt(btn.dataset.delta!);
      dateInput.value = toISOString(fromAbsoluteSeconds(pendingSecs));
      updateDisplay(pendingSecs);
    });
  });

  dateInput.addEventListener('input', () => {
    try {
      const d = parseISOString(dateInput.value.trim());
      pendingSecs = toAbsoluteSeconds(d);
      updateDisplay(pendingSecs);
      dateInput.style.borderColor = '';
    } catch { dateInput.style.borderColor = 'var(--theme-danger, #c06040)'; }
  });

  const close = makeCloser(pop);
  pop.querySelector('.popover-cancel')!.addEventListener('click', close);
  pop.querySelector('.popover-save')!.addEventListener('click', () => {
    onSave(toISOString(fromAbsoluteSeconds(pendingSecs)));
    close();
  });
}

// ---- Session Manager ----

export interface SessionManagerCallbacks {
  onActivate: (realDate: string | null) => void;
  onNew: (session: LegacySession, realDate: string) => void;
}

export function openSessionManagerPopover(
  anchor: HTMLButtonElement,
  currentSession: string | null,
  sessions: LegacySession[],
  currentNow: string,
  today: string,
  cb: SessionManagerCallbacks,
) {
  const pop = makePopover(true);
  positionAbove(pop, anchor);
  const close = makeCloser(pop);

  function render() {
    const others = sessions.filter(s => s.real_date !== currentSession);

    pop.innerHTML = `
      <div class="popover-title">Session</div>
      ${currentSession
        ? `<div class="session-active-row">
             <span class="session-active-badge">Active:</span>
             <span class="session-active-date">${currentSession}</span>
             <button class="session-stop-btn">Stop</button>
           </div>`
        : `<div class="session-none">No active session</div>`
      }
      ${others.length > 0 ? `
        <div class="popover-label" style="margin-top:6px">Past sessions</div>
        <div class="session-list">
          ${others.slice().reverse().map(s => `
            <button class="session-list-item" data-date="${s.real_date}">
              <span class="session-item-date">${s.real_date}</span>
              <span class="session-item-ingame">${s.in_game_start}</span>
            </button>
          `).join('')}
        </div>
      ` : ''}
      <div class="session-new-toggle">
        <button class="session-new-btn">+ Start new session</button>
      </div>
      <div class="session-new-form" hidden>
        <div class="popover-row">
          <label class="popover-label">Real-world date</label>
          <input type="text" name="real-date" class="popover-input" placeholder="2026-04-25" value="${today}">
        </div>
        <div class="popover-row">
          <label class="popover-label">In-game start</label>
          <input type="text" name="in-game" class="popover-input" placeholder="4726-05-04T18:30" value="${currentNow}">
        </div>
        <div class="popover-row">
          <label class="popover-label">Notes</label>
          <input type="text" name="notes" class="popover-input" placeholder="Optional">
        </div>
        <div class="popover-actions">
          <button class="session-new-cancel">Cancel</button>
          <button class="session-new-save is-primary">Start Session</button>
        </div>
      </div>
    `;

    pop.querySelector('.session-stop-btn')?.addEventListener('click', () => {
      cb.onActivate(null);
      close();
    });

    for (const btn of pop.querySelectorAll<HTMLButtonElement>('.session-list-item')) {
      btn.addEventListener('click', () => {
        cb.onActivate(btn.dataset.date!);
        close();
      });
    }

    const newBtn = pop.querySelector<HTMLButtonElement>('.session-new-btn')!;
    const newForm = pop.querySelector<HTMLElement>('.session-new-form')!;
    newBtn.addEventListener('click', () => {
      newForm.hidden = false;
      newBtn.closest('.session-new-toggle')!.remove();
    });

    pop.querySelector('.session-new-cancel')?.addEventListener('click', () => {
      newForm.hidden = true;
      const toggle = document.createElement('div');
      toggle.className = 'session-new-toggle';
      toggle.innerHTML = `<button class="session-new-btn">+ Start new session</button>`;
      newForm.after(toggle);
      toggle.querySelector('button')!.addEventListener('click', () => {
        newForm.hidden = false;
        toggle.remove();
      });
    });

    pop.querySelector('.session-new-save')?.addEventListener('click', () => {
      const realDate = (pop.querySelector<HTMLInputElement>('[name=real-date]')!).value.trim();
      const inGame = (pop.querySelector<HTMLInputElement>('[name=in-game]')!).value.trim();
      const notes = (pop.querySelector<HTMLInputElement>('[name=notes]')!).value.trim();
      if (!realDate || !inGame) return;
      try { parseISOString(inGame); } catch {
        (pop.querySelector<HTMLInputElement>('[name=in-game]')!).style.borderColor = 'var(--theme-danger, #c06040)';
        return;
      }
      cb.onNew({ real_date: realDate, in_game_start: inGame, notes }, realDate);
      close();
    });
  }

  render();
}
