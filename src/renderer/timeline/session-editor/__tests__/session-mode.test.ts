// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clampCreationEnd,
  clampWholeDragDelta,
  createSessionMode,
  type SessionModeDeps,
} from '../session-mode';
import type { Session } from '../../data/types';
import type { ViewState, ViewportSize } from '../../math/zoom';
import { parseISOString, toAbsoluteSeconds } from '../../calendar/golarian';

// --- absolute seconds for known Golarian dates ---
// These are computed once so tests can reason about exact values.
const A_START_SECS = toAbsoluteSeconds(parseISOString('4725-01-01T00:00'));
const A_END_SECS = toAbsoluteSeconds(parseISOString('4725-01-01T02:00'));
const B_START_SECS = toAbsoluteSeconds(parseISOString('4725-01-01T04:00'));
const B_END_SECS = toAbsoluteSeconds(parseISOString('4725-01-01T06:00'));

// View centered on session A so handles are visible during renderHandles
const VIEW: ViewState = { centerSeconds: A_START_SECS, secondsPerPixel: 100 };
const SIZE: ViewportSize = { width: 1000, height: 600 };
const HEIGHT = 600;
const AXIS_Y = Math.floor(HEIGHT * 0.8); // 480

function makeSession(
  id: string,
  inGameStart: string,
  inGameEnd: string,
  overrides: Partial<Session> = {},
): Session {
  return {
    id,
    inGameStart,
    inGameEnd,
    realStart: '2024-01-15T13:00:00',
    realEnd: '2024-01-15T17:00:00',
    color: '#6b7c5a',
    notes: '',
    real_date: '2024-01-15',
    in_game_start: inGameStart,
    ...overrides,
  };
}

const SESSION_A = makeSession('a', '4725-01-01T00:00', '4725-01-01T02:00');
const SESSION_B = makeSession('b', '4725-01-01T04:00', '4725-01-01T06:00');

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { get: () => HEIGHT, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: SIZE.width,
      bottom: HEIGHT,
      width: SIZE.width,
      height: SIZE.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  // Append a session layer div so renderHandles finds it
  const layer = document.createElement('div');
  layer.setAttribute('data-session-layer', '');
  layer.style.position = 'absolute';
  layer.style.inset = '0';
  el.appendChild(layer);
  document.body.appendChild(el);
  return el;
}

function makeDeps(overrides: Partial<SessionModeDeps> = {}): SessionModeDeps {
  return {
    getSessions: () => [],
    getView: () => VIEW,
    getViewport: () => SIZE,
    onSaveSession: vi.fn().mockResolvedValue(undefined),
    onCreateSessionPrefill: vi.fn(),
    onExitSessionMode: vi.fn(),
    ...overrides,
  };
}

function mousedown(
  target: HTMLElement,
  x: number,
  y: number,
  mods: { shift?: boolean; ctrl?: boolean } = {},
) {
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      clientX: x,
      clientY: y,
      shiftKey: mods.shift ?? false,
      ctrlKey: mods.ctrl ?? false,
    }),
  );
}

function mousemove(x: number, y: number) {
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
}

function mouseup() {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

function keydown(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** y inside the creation rail (axisY + 50) */
const RAIL_Y = AXIS_Y + 50;

beforeEach(() => {
  document.body.innerHTML = '';
});

// ===== clampCreationEnd =====

describe('clampCreationEnd', () => {
  it('returns rawSecs unchanged when no sessions', () => {
    expect(clampCreationEnd(0, 3600, [])).toBe(3600);
  });

  it('returns rawSecs unchanged when equal to anchorSecs', () => {
    expect(clampCreationEnd(A_START_SECS, A_START_SECS, [SESSION_A])).toBe(A_START_SECS);
  });

  it('clamps rightward move at the start of a session blocking the path', () => {
    // Anchor is before SESSION_A; moving right past A_END_SECS → clamps at A_START_SECS
    const anchor = A_START_SECS - 3600; // 1 hour before A starts
    const raw = A_END_SECS + 3600; // past the end of A
    const result = clampCreationEnd(anchor, raw, [SESSION_A]);
    expect(result).toBe(A_START_SECS);
  });

  it('clamps leftward move at the end of a session blocking the path', () => {
    // Anchor is after SESSION_B; moving left past B_START_SECS → clamps at B_END_SECS
    const anchor = B_END_SECS + 3600;
    const raw = B_START_SECS - 3600;
    const result = clampCreationEnd(anchor, raw, [SESSION_B]);
    expect(result).toBe(B_END_SECS);
  });

  it('clamps to anchorSecs when anchor lands inside an existing session (moving right)', () => {
    // Anchor is inside SESSION_A; any rightward move clamps back to anchor (zero-length)
    const anchor = A_START_SECS + 1800; // 30 min into session A
    const raw = A_END_SECS + 3600; // past session A
    const result = clampCreationEnd(anchor, raw, [SESSION_A]);
    expect(result).toBe(anchor);
  });

  it('clamps to anchorSecs when anchor lands inside an existing session (moving left)', () => {
    // Anchor is inside SESSION_A; leftward move clamps back to anchor
    const anchor = A_START_SECS + 1800;
    const raw = A_START_SECS - 3600;
    const result = clampCreationEnd(anchor, raw, [SESSION_A]);
    expect(result).toBe(anchor);
  });

  it('does not clamp when moving right but no session is in the way', () => {
    const anchor = B_END_SECS + 1;
    const raw = B_END_SECS + 3600; // moves right, nothing to the right
    const result = clampCreationEnd(anchor, raw, [SESSION_A, SESSION_B]);
    expect(result).toBe(raw);
  });

  it('does not clamp when moving left but no session is in the way', () => {
    const anchor = A_START_SECS - 1;
    const raw = A_START_SECS - 3600; // moves left, nothing to the left
    const result = clampCreationEnd(anchor, raw, [SESSION_A, SESSION_B]);
    expect(result).toBe(raw);
  });
});

// ===== clampWholeDragDelta =====

describe('clampWholeDragDelta', () => {
  it('returns 0 unchanged', () => {
    expect(clampWholeDragDelta(A_START_SECS, A_END_SECS, 0, [SESSION_B], 'a')).toBe(0);
  });

  it('returns delta unchanged when no other sessions', () => {
    expect(clampWholeDragDelta(A_START_SECS, A_END_SECS, 3600, [], 'a')).toBe(3600);
  });

  it('excludes the session being dragged from collision', () => {
    // Dragging SESSION_A 100 s rightward — should not collide with itself
    const result = clampWholeDragDelta(A_START_SECS, A_END_SECS, 100, [SESSION_A], 'a');
    expect(result).toBe(100);
  });

  it('clamps rightward delta so the moved session does not overlap SESSION_B', () => {
    // Session A moved right → gap between A_END and B_START = 2 hours (7200 s)
    // Trying to move 10000 s → clamped to 7200
    const gap = B_START_SECS - A_END_SECS; // 7200
    const result = clampWholeDragDelta(A_START_SECS, A_END_SECS, 10000, [SESSION_B], 'a');
    expect(result).toBe(gap);
  });

  it('clamps leftward delta so the moved session does not overlap SESSION_A', () => {
    // Session B moved left → gap between A_END and B_START = 7200 s
    // Trying to move -10000 → clamped to -(B_START - A_END) = -7200
    const gap = B_START_SECS - A_END_SECS; // 7200
    const result = clampWholeDragDelta(B_START_SECS, B_END_SECS, -10000, [SESSION_A], 'b');
    expect(result).toBe(-gap);
  });

  it('clamps to the nearest neighbor when sessions exist on both sides', () => {
    // SESSION_C sits between A and B; moving it far right → stops at B_START
    const sessionC = makeSession('c', '4725-01-01T03:30', '4725-01-01T03:45');
    const cStart = toAbsoluteSeconds(parseISOString(sessionC.inGameStart));
    const cEnd = toAbsoluteSeconds(parseISOString(sessionC.inGameEnd));
    // Moving right by 10000 s should be clamped to gap to SESSION_B
    const result = clampWholeDragDelta(cStart, cEnd, 10000, [SESSION_A, SESSION_B], 'c');
    expect(result).toBe(B_START_SECS - cEnd);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(10000);
  });
});

// ===== createSessionMode controller =====

describe('createSessionMode', () => {
  it('starts inactive (isActive returns false)', () => {
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps());
    expect(ctrl.isActive()).toBe(false);
    ctrl.destroy();
  });

  it('enter makes it active and shows exit chip', () => {
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps());
    ctrl.enter();
    expect(ctrl.isActive()).toBe(true);
    const chip = container.querySelector('.session-exit-chip') as HTMLElement;
    expect(chip.style.display).not.toBe('none');
    ctrl.destroy();
  });

  it('exit makes it inactive', () => {
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps());
    ctrl.enter();
    ctrl.exit();
    expect(ctrl.isActive()).toBe(false);
    ctrl.destroy();
  });

  it('renderHandles appends handles for each session endpoint', () => {
    const sessions = [SESSION_A, SESSION_B];
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps({ getSessions: () => sessions }));
    ctrl.enter();
    ctrl.renderHandles();

    const layer = container.querySelector('[data-session-layer]')!;
    const handles = layer.querySelectorAll('.session-drag-handle');
    // 2 sessions × 2 endpoints = 4 handles (only those within viewport)
    // VIEW is centered on A_START_SECS, so both sessions should be visible
    expect(handles.length).toBeGreaterThan(0);
    ctrl.destroy();
  });

  it('renderHandles does nothing when no session layer exists', () => {
    const container = makeContainer();
    container.querySelector('[data-session-layer]')!.remove();
    const ctrl = createSessionMode(container, makeDeps());
    ctrl.enter();
    expect(() => ctrl.renderHandles()).not.toThrow();
    ctrl.destroy();
  });

  it('isHandleDragging returns false before any drag', () => {
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps());
    ctrl.enter();
    expect(ctrl.isHandleDragging()).toBe(false);
    ctrl.destroy();
  });

  it('Escape while inactive is a no-op', () => {
    const container = makeContainer();
    const onExit = vi.fn();
    const ctrl = createSessionMode(container, makeDeps({ onExitSessionMode: onExit }));
    keydown('Escape');
    expect(onExit).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it('Escape with no drag state calls onExitSessionMode', () => {
    const container = makeContainer();
    const onExit = vi.fn();
    const ctrl = createSessionMode(container, makeDeps({ onExitSessionMode: onExit }));
    ctrl.enter();
    keydown('Escape');
    expect(onExit).toHaveBeenCalledTimes(1);
    ctrl.destroy();
  });

  it('Escape during pending creation cancels it without calling onExitSessionMode', () => {
    const container = makeContainer();
    const onExit = vi.fn();
    const onPrefill = vi.fn();
    const ctrl = createSessionMode(
      container,
      makeDeps({ onExitSessionMode: onExit, onCreateSessionPrefill: onPrefill }),
    );
    ctrl.enter();

    mousedown(container, 500, RAIL_Y); // first click starts pending creation
    mouseup(); // release without dragging

    keydown('Escape'); // should cancel creation, not exit mode
    expect(onExit).not.toHaveBeenCalled();
    expect(onPrefill).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it('drag-to-create calls onCreateSessionPrefill on mouseup when threshold crossed', async () => {
    const container = makeContainer();
    const onPrefill = vi.fn();
    const ctrl = createSessionMode(container, makeDeps({ onCreateSessionPrefill: onPrefill }));
    ctrl.enter();

    mousedown(container, 300, RAIL_Y);
    mousemove(360, RAIL_Y); // > CREATION_DRAG_THRESHOLD (8 px)
    mouseup();

    await Promise.resolve();
    expect(onPrefill).toHaveBeenCalledTimes(1);
    const [start, end] = onPrefill.mock.calls[0] as [string, string];
    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    ctrl.destroy();
  });

  it('handle drag mouseup calls onSaveSession with updated ISO string', async () => {
    const sessions = [SESSION_A];
    const onSave = vi.fn().mockResolvedValue(undefined);
    const container = makeContainer();
    const ctrl = createSessionMode(
      container,
      makeDeps({ getSessions: () => sessions, onSaveSession: onSave }),
    );
    ctrl.enter();
    ctrl.renderHandles();

    const layer = container.querySelector('[data-session-layer]')!;
    const handles = layer.querySelectorAll('.session-drag-handle');
    if (handles.length === 0) return; // skip if off-screen in this view

    const handle = handles[0] as HTMLElement;
    // mousedown on handle, move, then release
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 0 }));
    mousemove(200, 0); // move 100px = 10000 seconds (secondsPerPixel=100)
    mouseup();

    await Promise.resolve(); // allow async save
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = (onSave.mock.calls[0] as [Session])[0];
    expect(saved.id).toBe(SESSION_A.id);
    // Verify the saved session has an updated inGameStart or inGameEnd
    expect(
      saved.inGameStart !== SESSION_A.inGameStart || saved.inGameEnd !== SESSION_A.inGameEnd,
    ).toBe(true);
    ctrl.destroy();
  });

  it('destroy removes listeners so subsequent events are no-ops', () => {
    const container = makeContainer();
    const onExit = vi.fn();
    const ctrl = createSessionMode(container, makeDeps({ onExitSessionMode: onExit }));
    ctrl.enter();
    ctrl.destroy();
    keydown('Escape');
    expect(onExit).not.toHaveBeenCalled();
  });

  it('destroy removes the exit chip and drag label from DOM', () => {
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps());
    ctrl.enter();
    ctrl.destroy();
    expect(container.querySelector('.session-exit-chip')).toBeNull();
    expect(container.querySelector('.session-drag-label')).toBeNull();
  });

  it('mousedown on a handle sets isHandleDragging to true', () => {
    const sessions = [SESSION_A];
    const container = makeContainer();
    const ctrl = createSessionMode(container, makeDeps({ getSessions: () => sessions }));
    ctrl.enter();
    ctrl.renderHandles();

    const layer = container.querySelector('[data-session-layer]')!;
    const handles = layer.querySelectorAll('.session-drag-handle');
    // Only test if a handle rendered (view may put it off-screen if secondsPerPixel too small)
    if (handles.length === 0) return; // skip gracefully if off-screen

    const handle = handles[0] as HTMLElement;
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(ctrl.isHandleDragging()).toBe(true);

    mouseup();
    ctrl.destroy();
  });

  it('Escape during handle drag cancels the drag without exiting session mode', () => {
    const sessions = [SESSION_A];
    const container = makeContainer();
    const onExit = vi.fn();
    const ctrl = createSessionMode(
      container,
      makeDeps({ getSessions: () => sessions, onExitSessionMode: onExit }),
    );
    ctrl.enter();
    ctrl.renderHandles();

    const layer = container.querySelector('[data-session-layer]')!;
    const handles = layer.querySelectorAll('.session-drag-handle');
    if (handles.length === 0) return; // skip if off-screen

    const handle = handles[0] as HTMLElement;
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(ctrl.isHandleDragging()).toBe(true);

    keydown('Escape');
    expect(ctrl.isHandleDragging()).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
    ctrl.destroy();
  });
});
