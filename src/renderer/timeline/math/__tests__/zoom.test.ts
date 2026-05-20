import { describe, it, expect } from 'vitest';
import {
  xToSeconds,
  secondsToX,
  zoomAbout,
  panByPixels,
  SECONDS_PER_DAY,
  DEFAULT_SECONDS_PER_PIXEL,
} from '../zoom';
import type { ViewState, ViewportSize } from '../zoom';

const VIEW: ViewState = { centerSeconds: 1_000_000, secondsPerPixel: 100 };
const SIZE: ViewportSize = { width: 1000, height: 600 };

describe('xToSeconds', () => {
  it('center x maps to centerSeconds', () => {
    expect(xToSeconds(500, VIEW, SIZE)).toBe(1_000_000);
  });

  it('x to the right of center adds seconds', () => {
    expect(xToSeconds(600, VIEW, SIZE)).toBe(1_010_000);
  });

  it('x to the left of center subtracts seconds', () => {
    expect(xToSeconds(400, VIEW, SIZE)).toBe(990_000);
  });
});

describe('secondsToX', () => {
  it('centerSeconds maps to center x', () => {
    expect(secondsToX(1_000_000, VIEW, SIZE)).toBe(500);
  });

  it('seconds ahead of center maps right of center', () => {
    expect(secondsToX(1_010_000, VIEW, SIZE)).toBe(600);
  });

  it('round-trips with xToSeconds', () => {
    const x = 350;
    const s = xToSeconds(x, VIEW, SIZE);
    expect(secondsToX(s, VIEW, SIZE)).toBeCloseTo(x);
  });
});

describe('panByPixels', () => {
  it('positive delta shifts center back in time', () => {
    const result = panByPixels(VIEW, 100);
    expect(result.centerSeconds).toBe(1_000_000 - 100 * 100);
  });

  it('negative delta shifts center forward in time', () => {
    const result = panByPixels(VIEW, -100);
    expect(result.centerSeconds).toBe(1_000_000 + 100 * 100);
  });

  it('zero delta leaves center unchanged', () => {
    expect(panByPixels(VIEW, 0).centerSeconds).toBe(VIEW.centerSeconds);
  });

  it('does not change secondsPerPixel', () => {
    expect(panByPixels(VIEW, 50).secondsPerPixel).toBe(VIEW.secondsPerPixel);
  });

  it('returns a new object', () => {
    expect(panByPixels(VIEW, 10)).not.toBe(VIEW);
  });
});

describe('zoomAbout', () => {
  it('anchor pixel stays at the same seconds after zoom', () => {
    const anchorX = 300;
    const anchorSecs = xToSeconds(anchorX, VIEW, SIZE);
    const result = zoomAbout(VIEW, SIZE, anchorX, 2);
    expect(xToSeconds(anchorX, result, SIZE)).toBeCloseTo(anchorSecs);
  });

  it('zooming in (factor < 1) decreases secondsPerPixel', () => {
    const result = zoomAbout(VIEW, SIZE, 500, 0.5);
    expect(result.secondsPerPixel).toBeLessThan(VIEW.secondsPerPixel);
  });

  it('zooming out (factor > 1) increases secondsPerPixel', () => {
    const result = zoomAbout(VIEW, SIZE, 500, 2);
    expect(result.secondsPerPixel).toBeGreaterThan(VIEW.secondsPerPixel);
  });

  it('zoom about center x does not move centerSeconds', () => {
    const result = zoomAbout(VIEW, SIZE, 500, 3);
    expect(result.centerSeconds).toBeCloseTo(VIEW.centerSeconds);
  });

  it('clamps secondsPerPixel at minimum (1 s/px) when zooming in too far', () => {
    const nearMin: ViewState = { centerSeconds: 0, secondsPerPixel: 1.5 };
    const result = zoomAbout(nearMin, SIZE, 500, 0.1);
    expect(result.secondsPerPixel).toBe(1);
  });

  it('clamps secondsPerPixel at maximum (30 days/px) when zooming out too far', () => {
    const nearMax: ViewState = { centerSeconds: 0, secondsPerPixel: 30 * 86400 - 1 };
    const result = zoomAbout(nearMax, SIZE, 500, 100);
    expect(result.secondsPerPixel).toBe(30 * 86400);
  });
});

describe('constants', () => {
  it('SECONDS_PER_DAY is 86400', () => {
    expect(SECONDS_PER_DAY).toBe(86400);
  });

  it('DEFAULT_SECONDS_PER_PIXEL represents one day per 200 pixels', () => {
    expect(DEFAULT_SECONDS_PER_PIXEL).toBe(86400 / 200);
  });
});
