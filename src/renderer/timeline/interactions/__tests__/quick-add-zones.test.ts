// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQuickAddZones, QUICK_ADD_ZONE_TOP, QUICK_ADD_ZONE_BOTTOM } from '../quick-add-zones';
import type { QuickAddZonesDeps } from '../quick-add-zones';
import type { ViewState, ViewportSize } from '../../math/zoom';
import { secondsToX } from '../../math/zoom';

const HEIGHT = 600;
const WIDTH = 1000;
const AXIS_Y = Math.floor(HEIGHT * 0.8); // 480

// View/size where 1 pixel = 100 in-game seconds, center at x=500.
const VIEW: ViewState = { centerSeconds: 0, secondsPerPixel: 100 };
const SIZE: ViewportSize = { width: WIDTH, height: HEIGHT };

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { get: () => HEIGHT, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: WIDTH,
      bottom: HEIGHT,
      width: WIDTH,
      height: HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function makeDeps(overrides: Partial<QuickAddZonesDeps> = {}): {
  deps: QuickAddZonesDeps;
  onQuickAdd: ReturnType<typeof vi.fn>;
  onSetNow: ReturnType<typeof vi.fn>;
} {
  const onQuickAdd = vi.fn().mockResolvedValue(undefined);
  const onSetNow = vi.fn().mockResolvedValue(undefined);
  const deps: QuickAddZonesDeps = {
    getView: () => VIEW,
    getViewport: () => SIZE,
    isInteractionActive: () => false,
    shouldSuppressClick: () => false,
    onQuickAdd,
    onSetNow,
    ...overrides,
  };
  return { deps, onQuickAdd, onSetNow };
}

/** Mouse event at clientX/Y with optional modifiers. */
function mm(
  container: HTMLElement,
  x: number,
  y: number,
  mods: { shift?: boolean; ctrl?: boolean } = {},
) {
  container.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: x,
      clientY: y,
      shiftKey: mods.shift ?? false,
      ctrlKey: mods.ctrl ?? false,
    }),
  );
}

function click(
  container: HTMLElement,
  x: number,
  y: number,
  mods: { shift?: boolean } = {},
  target?: HTMLElement,
) {
  const event = new MouseEvent('click', {
    bubbles: true,
    clientX: x,
    clientY: y,
    shiftKey: mods.shift ?? false,
  });
  (target ?? container).dispatchEvent(event);
}

function keyup(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

/** x coordinate for a given raw (pre-snap) seconds offset from centerSeconds=0. */
function xAt(rawSecs: number) {
  // centerX=500, secondsPerPixel=100 → x = 500 + rawSecs/100
  return 500 + rawSecs / 100;
}

/** In-zone y coordinate (midpoint of the quick-add band). */
const ZONE_Y = AXIS_Y + Math.floor((QUICK_ADD_ZONE_TOP + QUICK_ADD_ZONE_BOTTOM) / 2);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('createQuickAddZones', () => {
  it('shows quick-add indicator on mousemove inside the zone', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);

    const el = container.querySelector('.quick-add') as HTMLElement;
    expect(el.style.display).not.toBe('none');
  });

  it('hides above the zone (y < axisY + QUICK_ADD_ZONE_TOP)', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // First show it, then move above
    mm(container, xAt(1800), ZONE_Y);
    mm(container, xAt(1800), AXIS_Y + QUICK_ADD_ZONE_TOP - 1);

    const el = container.querySelector('.quick-add') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('shows at the top boundary of the zone (y = axisY + QUICK_ADD_ZONE_TOP)', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), AXIS_Y + QUICK_ADD_ZONE_TOP);

    const el = container.querySelector('.quick-add') as HTMLElement;
    expect(el.style.display).not.toBe('none');
  });

  it('hides below the zone (y > axisY + QUICK_ADD_ZONE_BOTTOM)', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    mm(container, xAt(1800), AXIS_Y + QUICK_ADD_ZONE_BOTTOM + 1);

    const el = container.querySelector('.quick-add') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('shows at the bottom boundary of the zone (y = axisY + QUICK_ADD_ZONE_BOTTOM)', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), AXIS_Y + QUICK_ADD_ZONE_BOTTOM);

    const el = container.querySelector('.quick-add') as HTMLElement;
    expect(el.style.display).not.toBe('none');
  });

  it('hides when isInteractionActive returns true', () => {
    let active = false;
    const { deps } = makeDeps({ isInteractionActive: () => active });
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    expect((container.querySelector('.quick-add') as HTMLElement).style.display).not.toBe('none');

    active = true;
    mm(container, xAt(1800), ZONE_Y);
    expect((container.querySelector('.quick-add') as HTMLElement).style.display).toBe('none');
  });

  it('snaps to 10-minute grid (SNAP_SECS = 600) by default', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // rawSecs = 1800 (already on 10-min grid)
    mm(container, xAt(1800), ZONE_Y);

    const el = container.querySelector('.quick-add') as HTMLElement;
    const expectedX = secondsToX(1800, VIEW, SIZE);
    expect(el.style.left).toBe(`${expectedX}px`);
  });

  it('snaps to nearest 10-minute boundary for off-grid times', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // rawSecs = 1500 → snap to 1800 (round(1500/600)*600 = 3*600 = 1800)
    mm(container, xAt(1500), ZONE_Y);

    const el = container.querySelector('.quick-add') as HTMLElement;
    const expectedX = secondsToX(1800, VIEW, SIZE);
    expect(el.style.left).toBe(`${expectedX}px`);
  });

  it('Ctrl key snaps to 1-day grid', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // rawSecs = 50000 → day snap: round(50000/86400)*86400 = 1*86400 = 86400
    // (discriminates from a buggy impl that always returns 0)
    mm(container, xAt(50000), ZONE_Y, { ctrl: true });

    const el = container.querySelector('.quick-add') as HTMLElement;
    const expectedX = secondsToX(86400, VIEW, SIZE);
    expect(el.style.left).toBe(`${expectedX}px`);
  });

  it('Ctrl key shows day-only label (no time component)', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { ctrl: true });

    const label = container.querySelector('.quick-add-label') as HTMLElement;
    // Day-only label should not contain a colon (no "HH:MM")
    expect(label.textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it('without Ctrl key label shows day and time', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // rawSecs=1800 (00:30) → label has time
    mm(container, xAt(1800), ZONE_Y);

    const label = container.querySelector('.quick-add-label') as HTMLElement;
    expect(label.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('Shift key shows shift-preview and hides quick-add', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });

    expect((container.querySelector('.quick-add') as HTMLElement).style.display).toBe('none');
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).not.toBe(
      'none',
    );
  });

  it('Shift preview labels are populated', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });

    const date = container.querySelector('.shift-now-date') as HTMLElement;
    const year = container.querySelector('.shift-now-year') as HTMLElement;
    expect(date.textContent).toBeTruthy();
    expect(year.textContent).toMatch(/AR/);
  });

  it('Shift keyup hides shift-preview without waiting for mousemove', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).not.toBe(
      'none',
    );

    keyup('Shift');
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).toBe(
      'none',
    );
  });

  it('other keyup events do not hide shift-preview', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });
    keyup('Control');
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).not.toBe(
      'none',
    );
  });

  it('click calls onQuickAdd with snapped seconds from last mousemove', async () => {
    const { deps, onQuickAdd } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    const X = xAt(1800);
    mm(container, X, ZONE_Y);
    click(container, X, ZONE_Y);

    await vi.runAllTimersAsync().catch(() => {});
    // Allow promises to flush
    await Promise.resolve();

    expect(onQuickAdd).toHaveBeenCalledWith(1800);
  });

  it('click calls onSetNow with shift-preview seconds (not recomputed from click coords)', async () => {
    const { deps, onSetNow } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // Move while shift held → shiftPreviewSeconds = 1800
    mm(container, xAt(1800), ZONE_Y, { shift: true });
    // Click with shift held (simulating shift still pressed)
    click(container, xAt(1800), ZONE_Y, { shift: true });

    await Promise.resolve();
    expect(onSetNow).toHaveBeenCalledWith(1800);
    expect(onSetNow).toHaveBeenCalledTimes(1);
  });

  it('Shift+click does not call onQuickAdd', async () => {
    const { deps, onQuickAdd } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });
    click(container, xAt(1800), ZONE_Y, { shift: true });

    await Promise.resolve();
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it('click after Shift keyup does nothing (shiftPreviewSeconds cleared, quickAddSeconds null)', async () => {
    const { deps, onQuickAdd, onSetNow } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });
    keyup('Shift');
    // Without shift key at click time → falls through to quickAddSeconds check (which is null)
    click(container, xAt(1800), ZONE_Y);

    await Promise.resolve();
    expect(onQuickAdd).not.toHaveBeenCalled();
    expect(onSetNow).not.toHaveBeenCalled();
  });

  it('shouldSuppressClick returning true prevents any callback', async () => {
    const { deps, onQuickAdd, onSetNow } = makeDeps({ shouldSuppressClick: () => true });
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    click(container, xAt(1800), ZONE_Y);

    await Promise.resolve();
    expect(onQuickAdd).not.toHaveBeenCalled();
    expect(onSetNow).not.toHaveBeenCalled();
  });

  it('click on .event-card descendant does not call onQuickAdd', async () => {
    const { deps, onQuickAdd } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    const card = document.createElement('div');
    card.className = 'event-card';
    container.appendChild(card);

    mm(container, xAt(1800), ZONE_Y);
    // Click on the card element (which is inside the container)
    click(container, xAt(1800), ZONE_Y, {}, card);

    await Promise.resolve();
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it('quick-add indicator is hidden before onQuickAdd is awaited', async () => {
    let displayAtCallTime = 'unknown';
    const { deps } = makeDeps({
      onQuickAdd: async () => {
        const el = document.querySelector('.quick-add') as HTMLElement;
        displayAtCallTime = el?.style.display ?? 'unknown';
      },
    });
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    click(container, xAt(1800), ZONE_Y);

    await Promise.resolve();
    expect(displayAtCallTime).toBe('none');
  });

  it('mouseleave hides both indicators', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    expect((container.querySelector('.quick-add') as HTMLElement).style.display).not.toBe('none');

    container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect((container.querySelector('.quick-add') as HTMLElement).style.display).toBe('none');
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).toBe(
      'none',
    );
  });

  it('mouseleave also hides shift-preview', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).not.toBe(
      'none',
    );

    container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).toBe(
      'none',
    );
  });

  it('destroy removes listener so subsequent mousemove no longer shows indicator', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    const controller = createQuickAddZones(container, deps);

    controller.destroy();
    mm(container, xAt(1800), ZONE_Y);

    // DOM nodes removed
    expect(container.querySelector('.quick-add')).toBeNull();
    expect(container.querySelector('.shift-now-preview')).toBeNull();
  });

  it('destroy removes click listener so callbacks are not called after destroy', async () => {
    const { deps, onQuickAdd } = makeDeps();
    const container = makeContainer();
    const controller = createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    controller.destroy();
    click(container, xAt(1800), ZONE_Y);

    await Promise.resolve();
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it('destroy removes keyup listener so Shift keyup after destroy is a no-op', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    const controller = createQuickAddZones(container, deps);

    controller.destroy();
    // Should not throw
    expect(() => keyup('Shift')).not.toThrow();
  });

  it('hide() method clears both indicators immediately', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    const controller = createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y);
    expect((container.querySelector('.quick-add') as HTMLElement).style.display).not.toBe('none');

    controller.hide();
    expect((container.querySelector('.quick-add') as HTMLElement).style.display).toBe('none');
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).toBe(
      'none',
    );
  });

  it('switching from shift to no-shift on next mousemove shows quick-add instead of preview', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).not.toBe(
      'none',
    );

    mm(container, xAt(1800), ZONE_Y);
    expect((container.querySelector('.quick-add') as HTMLElement).style.display).not.toBe('none');
    expect((container.querySelector('.shift-now-preview') as HTMLElement).style.display).toBe(
      'none',
    );
  });

  it('labels panel sits at axisY + 66 below the axis', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    mm(container, xAt(1800), ZONE_Y, { shift: true });

    const labelsEl = container.querySelector('.shift-now-labels') as HTMLElement;
    expect(labelsEl.style.top).toBe(`${AXIS_Y + 66}px`);
  });

  it('time element is hidden when snapped seconds fall exactly on midnight', () => {
    const { deps } = makeDeps();
    const container = makeContainer();
    createQuickAddZones(container, deps);

    // Move to a position that snaps to 0 seconds (midnight of day 0) with shift
    mm(container, xAt(200), ZONE_Y, { shift: true });

    const timeEl = container.querySelector('.shift-now-time') as HTMLElement;
    // snapped to nearest SNAP_SECS (600): round(200/600)*600 = 0
    // 0 seconds = midnight → time should be hidden
    expect(timeEl.style.display).toBe('none');
  });
});
