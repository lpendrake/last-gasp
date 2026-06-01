// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { SNAP_SECS as SNAP_SECS_FROM_INCREMENTS } from '../time-increments';
import { SNAP_SECS as SNAP_SECS_FROM_ZONES, createQuickAddZones } from '../quick-add-zones';
import type { QuickAddZonesDeps } from '../quick-add-zones';
import { secondsToX } from '../../math/zoom';
import type { ViewState, ViewportSize } from '../../math/zoom';

const WIDTH = 1000;
const HEIGHT = 600;

const VIEW: ViewState = { centerSeconds: 3600, secondsPerPixel: 60 };
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

function makeDeps(): QuickAddZonesDeps {
  return {
    getView: () => VIEW,
    getViewport: () => SIZE,
    isInteractionActive: () => false,
    shouldSuppressClick: () => false,
    onQuickAdd: async () => {},
    onSetNow: async () => {},
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('quick-add keyboard API', () => {
  it('SNAP_SECS is shared between time-increments and quick-add-zones', () => {
    expect(SNAP_SECS_FROM_INCREMENTS).toBe(600);
    expect(SNAP_SECS_FROM_ZONES).toBe(600);
    expect(SNAP_SECS_FROM_INCREMENTS).toBe(SNAP_SECS_FROM_ZONES);
  });

  it('controller exposes keyboardShowAt and keyboardHide', () => {
    const container = makeContainer();
    const controller = createQuickAddZones(container, makeDeps());
    expect(typeof controller.keyboardShowAt).toBe('function');
    expect(typeof controller.keyboardHide).toBe('function');
  });

  it('keyboardShowAt shows the marker at the secondsToX position', () => {
    const container = makeContainer();
    // Use centerSeconds as the seconds we will pass so the result is width/2 = 500px
    const seconds = VIEW.centerSeconds;
    const deps: QuickAddZonesDeps = {
      getView: () => VIEW,
      getViewport: () => SIZE,
      isInteractionActive: () => false,
      shouldSuppressClick: () => false,
      onQuickAdd: async () => {},
      onSetNow: async () => {},
    };
    const controller = createQuickAddZones(container, deps);

    controller.keyboardShowAt(seconds);

    const marker = container.querySelector('.quick-add') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.style.display).not.toBe('none');

    const expectedX = secondsToX(seconds, VIEW, SIZE);
    expect(marker.style.left).toBe(`${expectedX}px`);
    // When seconds == centerSeconds, expectedX == width/2 == 500
    expect(expectedX).toBe(500);
  });
});
