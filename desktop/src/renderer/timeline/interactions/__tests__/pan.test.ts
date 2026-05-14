// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createPan } from '../pan';
import type { ViewState } from '../../math/zoom';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeView(): ViewState {
  return { centerSeconds: 1_000_000, secondsPerPixel: 100 };
}

interface Captured {
  view: ViewState;
}

function setup(
  opts: {
    shouldIgnore?: (e: MouseEvent) => boolean;
    isOtherDragActive?: () => boolean;
  } = {},
) {
  const container = makeContainer();
  const captured: Captured = { view: makeView() };
  const pan = createPan(container, {
    getView: () => captured.view,
    setView: (v) => {
      captured.view = v;
    },
    shouldIgnore: opts.shouldIgnore,
    isOtherDragActive: opts.isOtherDragActive,
  });
  return { container, pan, captured };
}

function md(container: HTMLElement, x: number) {
  container.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: 100, bubbles: true }));
}
function mm(x: number) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 100 }));
}
function mu() {
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: 0, clientY: 0 }));
}

describe('createPan', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts not dragging and not moved', () => {
    const { pan } = setup();
    expect(pan.isDragging()).toBe(false);
    expect(pan.wasMoved()).toBe(false);
  });

  it('mousedown puts us into dragging', () => {
    const { container, pan } = setup();
    md(container, 100);
    expect(pan.isDragging()).toBe(true);
    expect(pan.wasMoved()).toBe(false);
  });

  it('movement under the 5px threshold leaves wasMoved false and view unchanged', () => {
    const { container, pan, captured } = setup();
    const before = captured.view;
    md(container, 100);
    mm(102);
    mm(104);
    expect(pan.wasMoved()).toBe(false);
    expect(captured.view).toBe(before);
  });

  it('exactly 5px of movement engages the pan', () => {
    const { container, pan, captured } = setup();
    const before = captured.view;
    md(container, 100);
    mm(105);
    expect(pan.wasMoved()).toBe(true);
    expect(captured.view).not.toBe(before);
  });

  it('movement past the threshold pans the view in the correct direction', () => {
    const { container, captured } = setup();
    const before = captured.view.centerSeconds;
    md(container, 100);
    mm(110); // dragging right → panning left → center moves earlier in time
    expect(captured.view.centerSeconds).toBeLessThan(before);
  });

  it('does not change secondsPerPixel while panning', () => {
    const { container, captured } = setup();
    md(container, 100);
    mm(200);
    expect(captured.view.secondsPerPixel).toBe(makeView().secondsPerPixel);
  });

  it('mouseup ends the drag but keeps wasMoved until next mousedown', () => {
    const { container, pan } = setup();
    md(container, 100);
    mm(120);
    mu();
    expect(pan.isDragging()).toBe(false);
    expect(pan.wasMoved()).toBe(true);
    md(container, 100);
    expect(pan.wasMoved()).toBe(false);
  });

  it('cursor is "grabbing" during drag and restored on mouseup', () => {
    const { container } = setup();
    container.style.cursor = 'grab';
    md(container, 100);
    expect(container.style.cursor).toBe('grabbing');
    mu();
    expect(container.style.cursor).toBe('grab');
  });

  it('non-left-button mousedown does not start a drag', () => {
    const { container, pan } = setup();
    container.dispatchEvent(
      new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100, bubbles: true }),
    );
    expect(pan.isDragging()).toBe(false);
    mm(200);
    expect(pan.wasMoved()).toBe(false);
  });

  it('shouldIgnore returning true skips the mousedown', () => {
    const { container, pan } = setup({ shouldIgnore: () => true });
    md(container, 100);
    expect(pan.isDragging()).toBe(false);
    mm(120);
    expect(pan.wasMoved()).toBe(false);
  });

  it('isOtherDragActive returning true skips the mousedown', () => {
    let other = false;
    const { container, pan, captured } = setup({ isOtherDragActive: () => other });
    other = true;
    md(container, 100);
    expect(pan.isDragging()).toBe(false);
    const before = captured.view;
    mm(200);
    expect(captured.view).toBe(before);
  });

  it('wasMoved resets even when shouldIgnore prevents the drag', () => {
    const { pan } = setup({ shouldIgnore: () => true });
    // Since shouldIgnore=true, wasMoved never sets. Build a second pan to reach a
    // prior wasMoved=true state, then verify the next mousedown resets it.
    pan.destroy();
    const container2 = makeContainer();
    let ignore = false;
    const captured2: Captured = { view: makeView() };
    const pan2 = createPan(container2, {
      getView: () => captured2.view,
      setView: (v) => {
        captured2.view = v;
      },
      shouldIgnore: () => ignore,
    });
    // First gesture moves, sets wasMoved
    md(container2, 100);
    mm(200);
    mu();
    expect(pan2.wasMoved()).toBe(true);
    // Next mousedown resets wasMoved even if shouldIgnore prevents claiming the gesture
    ignore = true;
    md(container2, 200);
    expect(pan2.wasMoved()).toBe(false);
    pan2.destroy();
  });

  it('destroy removes all listeners so subsequent events are no-ops', () => {
    const { container, pan, captured } = setup();
    pan.destroy();
    md(container, 100);
    expect(pan.isDragging()).toBe(false);
    const before = captured.view;
    mm(200);
    expect(captured.view).toBe(before);
  });
});
