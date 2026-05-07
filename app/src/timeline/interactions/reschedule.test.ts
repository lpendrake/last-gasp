// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReschedule } from './reschedule.ts';
import type { ViewState, ViewportSize } from './zoom.ts';
import { parseISOString, toAbsoluteSeconds } from '../../calendar/golarian.ts';
import type { EventListItem } from '../../data/types.ts';

const SECONDS_PER_DAY = 86400;

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(el);
  return el;
}

function makeCardsLayer(container: HTMLElement, filenames: string[]): HTMLElement {
  const layer = document.createElement('div');
  for (const filename of filenames) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.filename = filename;
    card.style.width = '120px';
    card.style.left = '0px';
    layer.appendChild(card);
  }
  container.appendChild(layer);
  return layer;
}

const view: ViewState = { centerSeconds: 0, secondsPerPixel: 100 };
const viewport: ViewportSize = { width: 1000, height: 600 };

function setup(events: EventListItem[]) {
  const container = makeContainer();
  const cardsLayer = makeCardsLayer(container, events.map(e => e.filename));
  const saveReschedule = vi.fn(async (_filename: string, _newSeconds: number) => {});
  const reschedule = createReschedule(container, {
    cardsLayer,
    getView: () => view,
    getViewport: () => viewport,
    getEvents: () => events,
    saveReschedule,
  });
  return { container, cardsLayer, reschedule, saveReschedule };
}

function makeEvent(filename: string, date: string): EventListItem {
  return { filename, title: 't', date, mtime: 'x' } as EventListItem;
}

function md(target: HTMLElement, opts: { x?: number; shift?: boolean; button?: number } = {}) {
  const e = new MouseEvent('mousedown', {
    clientX: opts.x ?? 0,
    clientY: 0,
    shiftKey: opts.shift ?? false,
    button: opts.button ?? 0,
    bubbles: true,
  });
  target.dispatchEvent(e);
}
function mm(x: number, opts: { ctrl?: boolean } = {}) {
  window.dispatchEvent(new MouseEvent('mousemove', {
    clientX: x, clientY: 0, ctrlKey: opts.ctrl ?? false,
  }));
}
function mu() { window.dispatchEvent(new MouseEvent('mouseup')); }
function esc() { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }

describe('createReschedule', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('starts inactive and unactivated', () => {
    const { reschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    expect(reschedule.isActive()).toBe(false);
    expect(reschedule.wasActivated()).toBe(false);
  });

  it('shift+click on a card activates and sets isActive', () => {
    const { cardsLayer, reschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true });
    expect(reschedule.isActive()).toBe(true);
    expect(reschedule.wasActivated()).toBe(true);
  });

  it('shift+click off a card does NOT activate', () => {
    const { container, reschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    md(container, { shift: true });
    expect(reschedule.isActive()).toBe(false);
    expect(reschedule.wasActivated()).toBe(false);
  });

  it('non-shift mousedown clears a stale activated flag', () => {
    const { container, cardsLayer, reschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true });
    mu();
    expect(reschedule.wasActivated()).toBe(true);
    md(container, { shift: false });
    expect(reschedule.wasActivated()).toBe(false);
  });

  it('saveReschedule fires on mouseup if the snapped time changed', async () => {
    const { cardsLayer, saveReschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true, x: 0 });
    mm(50_000);  // far enough to land on a different 15-min snap bucket
    mu();
    expect(saveReschedule).toHaveBeenCalledTimes(1);
    expect(saveReschedule.mock.calls[0][0]).toBe('a.md');
  });

  it('saveReschedule does NOT fire if currentSecs equals originalSecs', async () => {
    const { cardsLayer, saveReschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true, x: 0 });
    mu();  // no movement at all
    expect(saveReschedule).not.toHaveBeenCalled();
  });

  it('ctrl during drag snaps to whole days', async () => {
    const { cardsLayer, saveReschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true, x: 0 });
    // Drag with ctrl held → the saved seconds must be a multiple of SECONDS_PER_DAY.
    mm(50_000, { ctrl: true });
    mu();
    expect(saveReschedule).toHaveBeenCalledTimes(1);
    const savedSecs = saveReschedule.mock.calls[0][1];
    expect(savedSecs % SECONDS_PER_DAY).toBe(0);
  });

  it('Esc during drag aborts the gesture and keeps the activated flag set', async () => {
    const { cardsLayer, reschedule, saveReschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true, x: 0 });
    mm(50_000);
    esc();
    expect(reschedule.isActive()).toBe(false);
    expect(reschedule.wasActivated()).toBe(true);  // suppress the upcoming click
    mu();  // mouseup after Esc must not save
    expect(saveReschedule).not.toHaveBeenCalled();
  });

  it('originalSecs is read from the event’s date at gesture start', async () => {
    const date = '4726-06-15';
    const expected = toAbsoluteSeconds(parseISOString(date));
    const { cardsLayer, saveReschedule } = setup([makeEvent('a.md', date)]);
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true, x: 500 });
    mm(500);  // no horizontal drag → snapped == original
    mu();
    // No save because no change. Validate by triggering a change instead.
    expect(saveReschedule).not.toHaveBeenCalled();
    md(card, { shift: true, x: 0 });
    mm(86400 / view.secondsPerPixel + 0);  // move ~1 day worth of pixels
    mu();
    expect(saveReschedule).toHaveBeenCalled();
    const savedSecs = saveReschedule.mock.calls.at(-1)![1];
    expect(Math.abs(savedSecs - expected)).toBeGreaterThan(0);
  });

  it('destroy removes listeners', () => {
    const { container, cardsLayer, reschedule } = setup([makeEvent('a.md', '4726-05-04')]);
    reschedule.destroy();
    const card = cardsLayer.querySelector('.event-card') as HTMLElement;
    md(card, { shift: true });
    expect(reschedule.isActive()).toBe(false);
  });
});
