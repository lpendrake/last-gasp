import type { Session } from '../../data/types.ts';
import { parseISOString } from '../../calendar/golarian.ts';
import { formatCompactWithTime } from '../../calendar/format.ts';

export interface SessionTooltipDeps {
  getSessions(): Session[];
}

function formatRealRange(realStart: string, realEnd: string): string {
  try {
    const s = new Date(realStart);
    const e = new Date(realEnd);
    const hs = s.getHours(), ms = String(s.getMinutes()).padStart(2, '0');
    const he = e.getHours(), me = String(e.getMinutes()).padStart(2, '0');
    const ampm = (h: number) => h >= 12 ? 'pm' : 'am';
    const h12 = (h: number) => h % 12 || 12;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const prefix = `${days[s.getDay()]} ${months[s.getMonth()]} ${s.getDate()} ${s.getFullYear()}`;
    return `${prefix} · ${h12(hs)}:${ms}${ampm(hs)} – ${h12(he)}:${me}${ampm(he)}`;
  } catch {
    return `${realStart} – ${realEnd}`;
  }
}

function formatGameRange(inGameStart: string, inGameEnd: string): string {
  try {
    const s = formatCompactWithTime(parseISOString(inGameStart));
    if (inGameStart === inGameEnd) return `${s} (instant)`;
    const e = formatCompactWithTime(parseISOString(inGameEnd));
    return `${s} – ${e}`;
  } catch {
    return inGameStart;
  }
}

export function createSessionTooltip(
  sessionLayer: HTMLElement,
  deps: SessionTooltipDeps,
): void {
  let tooltip: HTMLElement | null = null;

  function showTooltip(session: Session, anchorEl: HTMLElement) {
    removeTooltip();
    const el = document.createElement('div');
    el.className = 'session-tooltip';
    el.style.setProperty('--tooltip-border', session.color);

    const realLine = formatRealRange(session.realStart, session.realEnd);
    const gameLine = formatGameRange(session.inGameStart, session.inGameEnd);

    el.innerHTML = `
      <div class="session-tooltip-header">session · <span style="color:${session.color}">■</span> ${session.id}</div>
      <div class="session-tooltip-row"><span class="session-tooltip-key">real:</span> ${realLine}</div>
      <div class="session-tooltip-row"><span class="session-tooltip-key">game:</span> ${gameLine}</div>
    `;
    document.body.appendChild(el);
    tooltip = el;

    // Position near cursor / pill
    const rect = anchorEl.getBoundingClientRect();
    const tw = el.offsetWidth || 320;
    let left = rect.left;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (left < 8) left = 8;
    el.style.left = `${left}px`;
    el.style.top = `${rect.top - el.offsetHeight - 6}px`;
  }

  function removeTooltip() {
    tooltip?.remove();
    tooltip = null;
  }

  sessionLayer.addEventListener('mouseenter', (e) => {
    const pill = (e.target as HTMLElement).closest('.session-pill') as HTMLElement | null;
    if (!pill) return;
    const sessionId = pill.dataset.sessionId;
    if (!sessionId) return;
    const session = deps.getSessions().find(s => s.id === sessionId);
    if (!session) return;
    showTooltip(session, pill);
  }, true);

  sessionLayer.addEventListener('mouseleave', (e) => {
    const pill = (e.target as HTMLElement).closest('.session-pill') as HTMLElement | null;
    if (!pill) return;
    removeTooltip();
  }, true);
}
