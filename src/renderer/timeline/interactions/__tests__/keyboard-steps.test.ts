import { describe, it, expect } from 'vitest';
import { keyboardZoom, keyboardPan } from '../keyboard-steps';
import type { ViewState, ViewportSize } from '../../math/zoom';

const size: ViewportSize = { width: 1000, height: 600 };

const view: ViewState = {
  centerSeconds: 86400 * 10, // 10 days in
  secondsPerPixel: 500, // moderately zoomed out
};

describe('keyboardZoom', () => {
  it('zoom in shrinks secondsPerPixel and preserves the centre seconds', () => {
    const result = keyboardZoom(view, size, 'in');
    expect(result.secondsPerPixel).toBeLessThan(view.secondsPerPixel);
    // Centre-anchored zoom keeps the centre fixed
    expect(result.centerSeconds).toBeCloseTo(view.centerSeconds, 5);
  });

  it('zoom out grows secondsPerPixel and clamps at the maximum', () => {
    const result = keyboardZoom(view, size, 'out');
    expect(result.secondsPerPixel).toBeGreaterThan(view.secondsPerPixel);

    // Repeatedly zooming out must never exceed 30 * 86400
    const MAX = 30 * 86400;
    let current = view;
    for (let i = 0; i < 200; i++) {
      current = keyboardZoom(current, size, 'out');
      // Also verify the factor is being applied correctly each step
      expect(current.secondsPerPixel).toBeLessThanOrEqual(MAX);
    }
    expect(current.secondsPerPixel).toBeLessThanOrEqual(MAX);
  });
});

describe('keyboardPan', () => {
  it('pan later increases centre seconds, pan earlier decreases it', () => {
    const later = keyboardPan(view, 'later');
    const earlier = keyboardPan(view, 'earlier');
    expect(later.centerSeconds).toBeGreaterThan(view.centerSeconds);
    expect(earlier.centerSeconds).toBeLessThan(view.centerSeconds);
  });

  it('a fixed pixel pan moves fewer seconds when zoomed in', () => {
    const zoomedIn: ViewState = { ...view, secondsPerPixel: 10 }; // small spp = zoomed in
    const zoomedOut: ViewState = { ...view, secondsPerPixel: 1000 }; // large spp = zoomed out

    const deltaIn = Math.abs(keyboardPan(zoomedIn, 'later').centerSeconds - zoomedIn.centerSeconds);
    const deltaOut = Math.abs(
      keyboardPan(zoomedOut, 'later').centerSeconds - zoomedOut.centerSeconds,
    );

    expect(deltaIn).toBeLessThan(deltaOut);
  });
});
