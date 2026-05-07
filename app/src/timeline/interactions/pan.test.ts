// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createPan } from './pan.ts';
import type { ViewState } from './zoom.ts';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(el);
  return el;
}

function makeView(): ViewState {
  return { centerSeconds: 1_000_000, secondsPerPixel: 100 };
}

interface Captured {
  view: ViewState;
}

function setup(opts: {
  shouldIgnore?: (t: EventTarget | null) => boolean;
  isOtherDragActive?: () => boolean;
} = {}) {
  const container = makeContainer();
  const captured: Captured = { view: makeView() };
  const pan = createPan(container, {
    getView: () => captured.view,
    setView: (v) => { captured.view = v; },
    shouldIgnore: opts.shouldIgnore ?? (() => false),
    isOtherDragActive: opts.isOtherDragActive ?? (() => false),
  });
  return { container, pan, captured };
}

function md(container: HTMLElement, x: number, target?: HTMLElement) {
  const e = new MouseEvent('mousedown', { clientX: x, clientY: 100, bubbles: true });
  if (target) target.dispatchEvent(e); else container.dispatchEvent(e);
}
function mm(x: number) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 100 }));
}
function mu() {
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: 0, clientY: 0 }));
}

describe('createPan', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

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

  it('movement past the threshold sets wasMoved and pans the view', () => {
    const { container, pan, captured } = setup();
    const before = captured.view;
    md(container, 100);
    mm(110);
    expect(pan.wasMoved()).toBe(true);
    expect(captured.view).not.toBe(before);
    // panByPixels: centerSeconds shifts opposite the drag direction
    expect(captured.view.centerSeconds).toBeLessThan(before.centerSeconds);
  });

  it('mouseup ends the drag but keeps wasMoved set until next mousedown', () => {
    const { container, pan } = setup();
    md(container, 100);
    mm(120);
    mu();
    expect(pan.isDragging()).toBe(false);
    expect(pan.wasMoved()).toBe(true);
    md(container, 100);  // next gesture clears the flag
    expect(pan.wasMoved()).toBe(false);
  });

  it('shouldIgnore returning true makes mousedown a no-op', () => {
    const { container, pan } = setup({ shouldIgnore: () => true });
    md(container, 100);
    expect(pan.isDragging()).toBe(false);
    mm(120);
    expect(pan.wasMoved()).toBe(false);
  });

  it('isOtherDragActive returning true makes mousedown a no-op', () => {
    let other = false;
    const { container, pan, captured } = setup({ isOtherDragActive: () => other });
    other = true;
    md(container, 100);
    expect(pan.isDragging()).toBe(false);
    other = false;
    const before = captured.view;
    mm(200);
    expect(captured.view).toBe(before);
  });

  it('subsequent mousedown after a non-pan gesture clears the stale wasMoved flag', () => {
    const { container, pan } = setup();
    md(container, 100);
    mm(120);
    mu();
    expect(pan.wasMoved()).toBe(true);
    // A fresh mousedown that doesn't move should reset the flag.
    md(container, 200);
    expect(pan.wasMoved()).toBe(false);
    mu();
    expect(pan.wasMoved()).toBe(false);
  });

  it('destroy removes listeners', () => {
    const { container, pan, captured } = setup();
    pan.destroy();
    md(container, 100);
    expect(pan.isDragging()).toBe(false);
    const before = captured.view;
    mm(200);
    expect(captured.view).toBe(before);
  });
});
