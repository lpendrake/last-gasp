import type { Session } from '../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian.ts';
import { SESSION_COLORS, normalizeSession } from '../data/session-normalize.ts';

export interface SessionModalResult {
  status: 'saved' | 'deleted' | 'cancelled';
  session?: Session;
}

interface Prefill {
  inGameStart: string;
  inGameEnd: string;
}

function toDatetimeLocal(isoRealWorld: string): string {
  try {
    // datetime-local expects "YYYY-MM-DDTHH:MM"
    return isoRealWorld.slice(0, 16);
  } catch {
    return '';
  }
}

function fromDatetimeLocal(val: string): string {
  // Store as "YYYY-MM-DDTHH:MM:SS"
  return val.length === 16 ? val + ':00' : val;
}

function randomSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function validateGolarian(val: string): boolean {
  try {
    parseISOString(val);
    return true;
  } catch {
    return false;
  }
}

const COLOR_STORAGE_KEY = 'last-gasp:session-color-idx';

function nextDefaultColor(): string {
  const stored = localStorage.getItem(COLOR_STORAGE_KEY);
  const last = stored !== null ? parseInt(stored, 10) : -1;
  return SESSION_COLORS[(last + 1) % SESSION_COLORS.length];
}

function recordColorUsed(color: string): void {
  const idx = SESSION_COLORS.indexOf(color);
  if (idx >= 0) localStorage.setItem(COLOR_STORAGE_KEY, String(idx));
}

function colorSwatch(color: string, selected: boolean): string {
  return `<label class="session-color-swatch${selected ? ' is-selected' : ''}" style="--swatch:${color}">
    <input type="radio" name="session-color" value="${color}" ${selected ? 'checked' : ''}><span></span>
  </label>`;
}

/**
 * Open the session edit/create modal.
 * - Pass `session` to edit an existing session.
 * - Pass `prefill` (with inGameStart/inGameEnd) to create a new session.
 */
export async function openSessionEditModal(
  session: Session | null,
  prefill: Prefill | null,
  existingSessions: Session[] = [],
): Promise<SessionModalResult> {
  const isNew = session === null;
  const today = new Date().toISOString().slice(0, 10);
  const defaultRealStart = `${today}T12:00:00`;
  const defaultRealEnd = `${today}T16:00:00`;

  const src: Partial<Session> = session ?? {};
  const inGameStart = src.inGameStart ?? prefill?.inGameStart ?? '';
  const inGameEnd = src.inGameEnd ?? prefill?.inGameEnd ?? inGameStart;
  const realStart = src.realStart ?? defaultRealStart;
  const realEnd = src.realEnd ?? defaultRealEnd;
  const currentColor = src.color ?? nextDefaultColor();
  const currentId = src.id ?? today;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'session-modal';
  modal.style.setProperty('--modal-color', currentColor);

  modal.innerHTML = `
    <div class="session-modal-header" style="background:${currentColor}"></div>
    <button class="event-modal-close" aria-label="Close">×</button>
    <div class="session-modal-content">
      <h2 class="session-modal-title">${isNew ? 'New Session' : 'Edit Session'}</h2>

      <div class="session-modal-grid">
        <div class="session-modal-row">
          <label class="session-modal-label">Real-world start</label>
          <input type="datetime-local" class="session-modal-input" id="sm-real-start" value="${toDatetimeLocal(realStart)}">
        </div>
        <div class="session-modal-row">
          <label class="session-modal-label">Real-world end</label>
          <input type="datetime-local" class="session-modal-input" id="sm-real-end" value="${toDatetimeLocal(realEnd)}">
        </div>
        <div class="session-modal-row">
          <label class="session-modal-label">In-game start <span class="session-modal-hint">(Golarian ISO)</span></label>
          <input type="text" class="session-modal-input" id="sm-game-start" value="${inGameStart}" placeholder="4726-05-04T13:30">
        </div>
        <div class="session-modal-row">
          <label class="session-modal-label">In-game end <span class="session-modal-hint">(Golarian ISO)</span></label>
          <input type="text" class="session-modal-input" id="sm-game-end" value="${inGameEnd}" placeholder="4726-05-04T18:00">
        </div>
      </div>

      <div class="session-modal-color-row">
        <span class="session-modal-label">Color</span>
        <div class="session-color-swatches">
          ${SESSION_COLORS.map(c => colorSwatch(c, c === currentColor)).join('')}
        </div>
      </div>

      <div class="session-modal-error" id="sm-error" hidden></div>

      <div class="event-modal-actions">
        ${!isNew ? '<button class="event-modal-btn event-modal-btn-danger" id="sm-delete">Delete</button>' : ''}
        <button class="event-modal-btn" id="sm-cancel">Cancel</button>
        <button class="event-modal-btn event-modal-btn-primary" id="sm-save">Save</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  return new Promise<SessionModalResult>((resolve) => {
    let resolved = false;
    const close = (result: SessionModalResult) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close({ status: 'cancelled' }); }
    };
    window.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close({ status: 'cancelled' });
    });
    modal.querySelector('#sm-cancel')!.addEventListener('click', () => close({ status: 'cancelled' }));
    modal.querySelector('.event-modal-close')!.addEventListener('click', () => close({ status: 'cancelled' }));

    modal.querySelector('#sm-delete')?.addEventListener('click', () => close({ status: 'deleted' }));

    modal.querySelector('#sm-save')!.addEventListener('click', () => {
      const errorEl = modal.querySelector<HTMLElement>('#sm-error')!;
      errorEl.hidden = true;

      const realStartVal = fromDatetimeLocal((modal.querySelector<HTMLInputElement>('#sm-real-start')!).value);
      const realEndVal = fromDatetimeLocal((modal.querySelector<HTMLInputElement>('#sm-real-end')!).value);
      const gameStartVal = (modal.querySelector<HTMLInputElement>('#sm-game-start')!).value.trim();
      const gameEndVal = (modal.querySelector<HTMLInputElement>('#sm-game-end')!).value.trim();
      let idVal: string;
      if (isNew) {
        do { idVal = randomSessionId(); } while (existingSessions.some(s => s.id === idVal));
      } else {
        idVal = currentId;
      }
      const selectedColor = (modal.querySelector<HTMLInputElement>('input[name="session-color"]:checked')!).value;

      // Validate
      if (!gameStartVal || !validateGolarian(gameStartVal)) {
        errorEl.textContent = 'Invalid in-game start date.';
        errorEl.hidden = false;
        return;
      }
      if (!gameEndVal || !validateGolarian(gameEndVal)) {
        errorEl.textContent = 'Invalid in-game end date.';
        errorEl.hidden = false;
        return;
      }

      // Validate same-day in-game overlap (requirement 4)
      if (existingSessions.length > 0) {
        const realDay = realStartVal.slice(0, 10);
        const editingId = isNew ? idVal : currentId;
        const sameDaySessions = existingSessions.filter(s =>
          s.id !== editingId && s.realStart.slice(0, 10) === realDay
        );
        try {
          const newStart = toAbsoluteSeconds(parseISOString(gameStartVal));
          const newEnd = toAbsoluteSeconds(parseISOString(gameEndVal));
          for (const s of sameDaySessions) {
            const existStart = toAbsoluteSeconds(parseISOString(s.inGameStart));
            const existEnd = toAbsoluteSeconds(parseISOString(s.inGameEnd));
            const overlaps = newStart < existEnd && existStart < newEnd
              && !(newEnd === existStart || existEnd === newStart);
            if (overlaps) {
              errorEl.textContent = 'In-game time overlaps another session on the same real-world day.';
              errorEl.hidden = false;
              return;
            }
          }
        } catch { /* parse errors already caught above */ }
      }

      const saved: Session = normalizeSession({
        id: idVal,
        inGameStart: gameStartVal,
        inGameEnd: gameEndVal,
        realStart: realStartVal,
        realEnd: realEndVal,
        color: selectedColor,
        notes: session?.notes ?? '',
        real_date: realStartVal.slice(0, 10),
        in_game_start: gameStartVal,
      }, 0);
      // Override color (normalizeSession would cycle if missing, but we have it)
      saved.color = selectedColor;

      recordColorUsed(selectedColor);
      close({ status: 'saved', session: saved });
    });
  });
}
