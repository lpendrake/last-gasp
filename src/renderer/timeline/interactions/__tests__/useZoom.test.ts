import { describe, it, expect } from 'vitest';
import { applyWheelZoom } from '../useZoom';
import { xToSeconds, SECONDS_PER_DAY } from '../../math/zoom';
import type { ViewState, ViewportSize } from '../../math/zoom';

const VIEW: ViewState = { centerSeconds: 1_000_000, secondsPerPixel: 100 };
const SIZE: ViewportSize = { width: 1000, height: 600 };

describe('applyWheelZoom', () => {
  it('anchor pixel x stays at the same in-game seconds after zoom', () => {
    const anchorX = 300;
    const anchorSecsBefore = xToSeconds(anchorX, VIEW, SIZE);
    const result = applyWheelZoom(anchorX, -100, VIEW, SIZE);
    expect(xToSeconds(anchorX, result, SIZE)).toBeCloseTo(anchorSecsBefore, 6);
  });

  it('negative deltaY zooms in (decreases secondsPerPixel)', () => {
    const result = applyWheelZoom(500, -500, VIEW, SIZE);
    expect(result.secondsPerPixel).toBeLessThan(VIEW.secondsPerPixel);
  });

  it('positive deltaY zooms out (increases secondsPerPixel)', () => {
    const result = applyWheelZoom(500, 500, VIEW, SIZE);
    expect(result.secondsPerPixel).toBeGreaterThan(VIEW.secondsPerPixel);
  });

  it('zero deltaY leaves view unchanged', () => {
    const result = applyWheelZoom(500, 0, VIEW, SIZE);
    expect(result.centerSeconds).toBeCloseTo(VIEW.centerSeconds);
    expect(result.secondsPerPixel).toBeCloseTo(VIEW.secondsPerPixel);
  });

  it('zooming about the viewport center does not shift centerSeconds', () => {
    const centerX = SIZE.width / 2;
    const result = applyWheelZoom(centerX, -500, VIEW, SIZE);
    expect(result.centerSeconds).toBeCloseTo(VIEW.centerSeconds, 6);
  });

  it('anchor invariant holds for off-center cursor positions', () => {
    const anchorX = 800;
    const anchorSecsBefore = xToSeconds(anchorX, VIEW, SIZE);
    const result = applyWheelZoom(anchorX, 300, VIEW, SIZE);
    expect(xToSeconds(anchorX, result, SIZE)).toBeCloseTo(anchorSecsBefore, 6);
  });

  it('clamps at minimum zoom (1 s/px) when zooming in past the limit', () => {
    const nearMin: ViewState = { centerSeconds: 0, secondsPerPixel: 1.1 };
    const result = applyWheelZoom(500, -100_000, nearMin, SIZE);
    expect(result.secondsPerPixel).toBe(1);
  });

  it('clamps at maximum zoom (30 days/px) when zooming out past the limit', () => {
    const nearMax: ViewState = { centerSeconds: 0, secondsPerPixel: 30 * SECONDS_PER_DAY - 1 };
    const result = applyWheelZoom(500, 100_000, nearMax, SIZE);
    expect(result.secondsPerPixel).toBe(30 * SECONDS_PER_DAY);
  });

  it('returns a new object (immutable)', () => {
    const result = applyWheelZoom(500, -100, VIEW, SIZE);
    expect(result).not.toBe(VIEW);
  });
});
