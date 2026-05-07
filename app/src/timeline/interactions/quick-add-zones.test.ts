// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQuickAddZones } from './quick-add-zones.ts';
import type { ViewState, ViewportSize } from './zoom.ts';

const SECONDS_PER_DAY = 86400;
const CONTAINER_HEIGHT = 600;
const AXIS_Y = Math.floor(CONTAINER_HEIGHT * 0.8);  // 480
const ZONE_TOP = AXIS_Y + 4;
const ZONE_BOTTOM = AXIS_Y + 68;

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: CONTAINER_HEIGHT, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true });
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 1000, bottom: CONTAINER_HEIGHT,
    width: 1000, height: CONTAINER_HEIGHT, x: 0, y: 0, toJSON() {},
  });
  document.body.appendChild(el);
  return el;
}

const view: ViewState = { centerSeconds: 0, secondsPerPixel: 100 };
const viewport: ViewportSize = { width: 1000, height: CONTAINER_HEIGHT };

interface Flags {
  interactionActive: boolean;
  suppressClick: boolean;
}

function setup() {
  const container = makeContainer();
  const flags: Flags = { interactionActive: false, suppressClick: false };
  const onQuickAdd = vi.fn(async (_secs: number) => {});
  const onSetNow = vi.fn(async (_secs: number) => {});
  const ctrl = createQuickAddZones(container, {
    getView: () => view,
    getViewport: () => viewport,
    isInteractionActive: () => flags.interactionActive,
    shouldSuppressClick: () => flags.suppressClick,
    onQuickAdd,
    onSetNow,
  });
  return { container, ctrl, onQuickAdd, onSetNow, flags };
}

function mm(container: HTMLElement, x: number, y: number, opts: { shift?: boolean; ctrl?: boolean } = {}) {
  container.dispatchEvent(new MouseEvent('mousemove', {
    clientX: x, clientY: y,
    shiftKey: opts.shift ?? false, ctrlKey: opts.ctrl ?? false,
    bubbles: true,
  }));
}
function click(target: HTMLElement, opts: { shift?: boolean } = {}) {
  target.dispatchEvent(new MouseEvent('click', {
    shiftKey: opts.shift ?? false, bubbles: true,
  }));
}

function quickAddVisible(container: HTMLElement): boolean {
  const el = container.querySelector('.quick-add') as HTMLElement;
  return el?.style.display !== 'none';
}
function shiftPreviewVisible(container: HTMLElement): boolean {
  const el = container.querySelector('.shift-now-preview') as HTMLElement;
  return el?.style.display !== 'none';
}

describe('createQuickAddZones', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('creates the quick-add and shift-preview DOM elements, hidden initially', () => {
    const { container } = setup();
    expect(container.querySelector('.quick-add')).toBeTruthy();
    expect(container.querySelector('.shift-now-preview')).toBeTruthy();
    expect(quickAddVisible(container)).toBe(false);
    expect(shiftPreviewVisible(container)).toBe(false);
  });

  it('shows quick-add inside the zone and hides outside', () => {
    const { container } = setup();
    mm(container, 200, ZONE_TOP + 10);
    expect(quickAddVisible(container)).toBe(true);

    mm(container, 200, ZONE_TOP - 10);
    expect(quickAddVisible(container)).toBe(false);

    mm(container, 200, ZONE_TOP + 10);
    expect(quickAddVisible(container)).toBe(true);

    mm(container, 200, ZONE_BOTTOM + 10);
    expect(quickAddVisible(container)).toBe(false);
  });

  it('shift inside the zone shows the set-now preview, not the quick-add', () => {
    const { container } = setup();
    mm(container, 200, ZONE_TOP + 10, { shift: true });
    expect(shiftPreviewVisible(container)).toBe(true);
    expect(quickAddVisible(container)).toBe(false);
  });

  it('shift release (keyup) hides the shift preview', () => {
    const { container } = setup();
    mm(container, 200, ZONE_TOP + 10, { shift: true });
    expect(shiftPreviewVisible(container)).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    expect(shiftPreviewVisible(container)).toBe(false);
  });

  it('isInteractionActive hides indicators', () => {
    const { container, flags } = setup();
    mm(container, 200, ZONE_TOP + 10);
    expect(quickAddVisible(container)).toBe(true);

    flags.interactionActive = true;
    mm(container, 200, ZONE_TOP + 10);
    expect(quickAddVisible(container)).toBe(false);
  });

  it('mouseleave hides indicators', () => {
    const { container } = setup();
    mm(container, 200, ZONE_TOP + 10);
    expect(quickAddVisible(container)).toBe(true);
    container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    expect(quickAddVisible(container)).toBe(false);
  });

  it('clicking inside the zone with quick-add active calls onQuickAdd with snapped seconds', () => {
    const { container, onQuickAdd } = setup();
    mm(container, 200, ZONE_TOP + 10);
    click(container);
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    const secs = onQuickAdd.mock.calls[0][0];
    // 15-minute snap (900s)
    expect(Math.abs(secs % 900)).toBe(0);
  });

  it('ctrl held during hover snaps to whole days', () => {
    const { container, onQuickAdd } = setup();
    mm(container, 200, ZONE_TOP + 10, { ctrl: true });
    click(container);
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect(Math.abs(onQuickAdd.mock.calls[0][0] % SECONDS_PER_DAY)).toBe(0);
  });

  it('clicking on an event-card child does NOT trigger onQuickAdd', () => {
    const { container, onQuickAdd } = setup();
    mm(container, 200, ZONE_TOP + 10);
    const card = document.createElement('div');
    card.className = 'event-card';
    container.appendChild(card);
    click(card);
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it('shift+click with the shift preview active calls onSetNow', () => {
    const { container, onSetNow, onQuickAdd } = setup();
    mm(container, 200, ZONE_TOP + 10, { shift: true });
    click(container, { shift: true });
    expect(onSetNow).toHaveBeenCalledTimes(1);
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it('shouldSuppressClick blocks both click paths', () => {
    const { container, flags, onQuickAdd, onSetNow } = setup();
    mm(container, 200, ZONE_TOP + 10);
    flags.suppressClick = true;
    click(container);
    expect(onQuickAdd).not.toHaveBeenCalled();
    expect(onSetNow).not.toHaveBeenCalled();
  });

  it('hide() clears both indicators', () => {
    const { container, ctrl } = setup();
    mm(container, 200, ZONE_TOP + 10);
    expect(quickAddVisible(container)).toBe(true);
    ctrl.hide();
    expect(quickAddVisible(container)).toBe(false);
    expect(shiftPreviewVisible(container)).toBe(false);
  });

  it('destroy removes listeners and the gesture-owned DOM', () => {
    const { container, ctrl, onQuickAdd } = setup();
    ctrl.destroy();
    expect(container.querySelector('.quick-add')).toBeNull();
    expect(container.querySelector('.shift-now-preview')).toBeNull();
    mm(container, 200, ZONE_TOP + 10);
    click(container);
    expect(onQuickAdd).not.toHaveBeenCalled();
  });
});
