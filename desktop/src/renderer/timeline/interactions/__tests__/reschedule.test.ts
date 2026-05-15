// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReschedule } from '../reschedule';
import type { RescheduleDeps } from '../reschedule';
import type { ViewState, ViewportSize } from '../../math/zoom';
import type { EventListItem } from '../../data/types';

// ---- Helpers ----

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeLabel(): HTMLElement {
  const el = document.createElement('div');
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}

function makeView(): ViewState {
  // 100 seconds per pixel; center at 1_000_000s at x=500
  return { centerSeconds: 1_000_000, secondsPerPixel: 100 };
}

function makeSize(): ViewportSize {
  return { width: 1000, height: 600 };
}

function makeEvent(filename: string, date: string): EventListItem {
  return { filename, title: 'Test', date, mtime: '2026-01-01T00:00:00Z' };
}

function makeCard(container: HTMLElement, filename: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.dataset.filename = filename;
  card.style.width = '120px';
  container.appendChild(card);
  return card;
}

function makeConnector(container: HTMLElement, filename: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'event-card-connector';
  el.dataset.filename = filename;
  container.appendChild(el);
  return el;
}

function makeDot(container: HTMLElement, filename: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'event-card-dot';
  el.dataset.filename = filename;
  container.appendChild(el);
  return el;
}

function setup(events: EventListItem[] = [], overrides: Partial<RescheduleDeps> = {}) {
  const container = makeContainer();
  const label = makeLabel();
  const view = makeView();
  const size = makeSize();
  const saveReschedule = vi.fn().mockResolvedValue(undefined);

  const deps: RescheduleDeps = {
    getView: () => view,
    getSize: () => size,
    getEvents: () => events,
    getDragLabel: () => label,
    saveReschedule,
    ...overrides,
  };

  const ctrl = createReschedule(container, deps);
  return { container, label, ctrl, saveReschedule, view, size };
}

function shiftDown(target: HTMLElement, x = 200) {
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      shiftKey: true,
      button: 0,
      clientX: x,
      clientY: 100,
      bubbles: true,
    }),
  );
}

function down(target: HTMLElement, x = 200) {
  target.dispatchEvent(
    new MouseEvent('mousedown', { button: 0, clientX: x, clientY: 100, bubbles: true }),
  );
}

function move(x: number, ctrl = false) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 100, ctrlKey: ctrl }));
}

function up() {
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: 0, clientY: 0 }));
}

function esc() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

// ---- Tests ----

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('createReschedule — initial state', () => {
  it('is not active and not activated on creation', () => {
    const { ctrl } = setup();
    expect(ctrl.isActive()).toBe(false);
    expect(ctrl.wasActivated()).toBe(false);
  });
});

describe('createReschedule — mousedown handling', () => {
  it('shift+click on a card with a known event starts the session', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl } = setup([ev]);
    makeCard(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!);
    expect(ctrl.isActive()).toBe(true);
    expect(ctrl.wasActivated()).toBe(true);
  });

  it('plain click on a card does not start a session', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl } = setup([ev]);
    makeCard(container, 'a.md');
    down(container.querySelector('.event-card')!);
    expect(ctrl.isActive()).toBe(false);
    expect(ctrl.wasActivated()).toBe(false);
  });

  it('shift+click on the container (not a card) does not start a session', () => {
    const { container, ctrl } = setup([makeEvent('a.md', '4726-05-04')]);
    shiftDown(container);
    expect(ctrl.isActive()).toBe(false);
    expect(ctrl.wasActivated()).toBe(false);
  });

  it('shift+click on a card with no matching event does not start a session', () => {
    const { container, ctrl } = setup([]); // no events registered
    makeCard(container, 'ghost.md');
    shiftDown(container.querySelector('.event-card')!);
    expect(ctrl.isActive()).toBe(false);
    expect(ctrl.wasActivated()).toBe(false);
  });

  it('plain mousedown clears wasActivated', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl } = setup([ev]);
    makeCard(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!);
    expect(ctrl.wasActivated()).toBe(true);
    // A subsequent plain click clears the flag
    down(container);
    expect(ctrl.wasActivated()).toBe(false);
  });

  it('adds is-rescheduling class to the card on drag start', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card);
    expect(card.classList.contains('is-rescheduling')).toBe(true);
  });

  it('sets cursor to ew-resize on the container while dragging', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card);
    expect(container.style.cursor).toBe('ew-resize');
  });
});

describe('createReschedule — mousemove / snap', () => {
  it('snaps position to the nearest 900s (15 min) grid by default', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, saveReschedule } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(600); // large drag to ensure snapped value differs from original
    await up();
    expect(saveReschedule).toHaveBeenCalledOnce();
    const newSecs = (saveReschedule.mock.calls[0] as [string, number])[1];
    expect(newSecs % 900).toBe(0);
  });

  it('snaps to the nearest day when ctrl is held', async () => {
    // 4726-05-04 is all-day so originalSecs % 86400 === 0.
    // Need >half-day (43200s = 432px at spp=100) to snap to the NEXT day.
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, saveReschedule } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(1000, /* ctrl= */ true); // 500px = 50000s > 0.5 day → snaps to next day
    await up();
    expect(saveReschedule).toHaveBeenCalledOnce();
    const newSecs = (saveReschedule.mock.calls[0] as [string, number])[1];
    expect(newSecs % 86400).toBe(0);
  });

  it('shows and updates the drag label on move', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, label } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(510);
    expect(label.style.display).toBe('');
    expect(label.textContent).toMatch(/\d{2}:\d{2}/); // has a time component
  });

  it('moves connector and dot elements along with the card', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev]);
    const card = makeCard(container, 'a.md');
    const connector = makeConnector(container, 'a.md');
    const dot = makeDot(container, 'a.md');
    shiftDown(card, 500);
    move(510);
    expect(connector.style.left).not.toBe('');
    expect(dot.style.left).not.toBe('');
    // connector and dot share the same x as the snapped position
    expect(connector.style.left).toBe(dot.style.left);
  });
});

describe('createReschedule — mouseup / save', () => {
  it('calls saveReschedule with new time when position changed', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, saveReschedule } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(600); // drag 100px right → ~10000s change
    await up();
    expect(saveReschedule).toHaveBeenCalledOnce();
    const [filename, newSecs] = saveReschedule.mock.calls[0] as [string, number];
    expect(filename).toBe('a.md');
    expect(newSecs % 900).toBe(0); // snapped to 15min
  });

  it('does NOT call saveReschedule when position did not change', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, saveReschedule } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    // No move — or a sub-snap move that rounds back to original
    await up();
    expect(saveReschedule).not.toHaveBeenCalled();
  });

  it('clears isActive and removes visual state on mouseup', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl, label } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(600);
    await up();
    expect(ctrl.isActive()).toBe(false);
    expect(card.classList.contains('is-rescheduling')).toBe(false);
    expect(container.style.cursor).toBe('');
    expect(label.style.display).toBe('none');
  });

  it('wasActivated stays true after mouseup (to suppress click)', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(600);
    await up();
    expect(ctrl.wasActivated()).toBe(true);
  });
});

describe('createReschedule — Escape abort', () => {
  it('escape during drag reverts card to the original-seconds position', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev]);
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(600); // drag to a different position
    const movedLeft = card.style.left;
    esc();
    // card is back to originalSecs-derived x (different from where the drag left it)
    expect(card.style.left).not.toBe(movedLeft);
  });

  it('escape ends the session (isActive becomes false)', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl } = setup([ev]);
    makeCard(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!);
    expect(ctrl.isActive()).toBe(true);
    esc();
    expect(ctrl.isActive()).toBe(false);
  });

  it('escape does NOT call saveReschedule', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, saveReschedule } = setup([ev]);
    makeCard(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!);
    move(600);
    esc();
    expect(saveReschedule).not.toHaveBeenCalled();
  });

  it('wasActivated stays true after escape (click still suppressed)', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl } = setup([ev]);
    makeCard(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!);
    move(600);
    esc();
    expect(ctrl.wasActivated()).toBe(true);
  });

  it('escape reverts connector and dot positions', () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev]);
    makeCard(container, 'a.md');
    const connector = makeConnector(container, 'a.md');
    const dot = makeDot(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!, 500);
    move(600);
    const movedConnector = connector.style.left;
    esc();
    expect(connector.style.left).not.toBe(movedConnector);
    expect(dot.style.left).not.toBe(movedConnector);
  });
});

describe('createReschedule — save failure revert', () => {
  it('reverts card away from dragged position when saveReschedule rejects', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev], {
      saveReschedule: vi.fn().mockRejectedValue(new Error('conflict')),
    });
    const card = makeCard(container, 'a.md');
    shiftDown(card, 500);
    move(600);
    const draggedLeft = card.style.left;
    await up();
    // placeAt(originalSecs) fires in the catch — card is back at original x, not dragged x
    expect(card.style.left).not.toBe(draggedLeft);
    expect(card.style.left).toMatch(/px$/);
  });

  it('reverts connector and dot away from dragged position when saveReschedule rejects', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container } = setup([ev], {
      saveReschedule: vi.fn().mockRejectedValue(new Error('conflict')),
    });
    makeCard(container, 'a.md');
    const connector = makeConnector(container, 'a.md');
    const dot = makeDot(container, 'a.md');
    shiftDown(container.querySelector('.event-card')!, 500);
    move(600);
    const draggedConnector = connector.style.left;
    await up();
    expect(connector.style.left).not.toBe(draggedConnector);
    expect(dot.style.left).not.toBe(draggedConnector);
    // connector and dot are at the same (original) x after revert
    expect(connector.style.left).toBe(dot.style.left);
  });
});

describe('createReschedule — destroy', () => {
  it('destroy removes all listeners so events are no-ops', async () => {
    const ev = makeEvent('a.md', '4726-05-04');
    const { container, ctrl, saveReschedule } = setup([ev]);
    makeCard(container, 'a.md');
    ctrl.destroy();
    shiftDown(container.querySelector('.event-card')!);
    expect(ctrl.isActive()).toBe(false);
    move(600);
    await up();
    expect(saveReschedule).not.toHaveBeenCalled();
  });
});
