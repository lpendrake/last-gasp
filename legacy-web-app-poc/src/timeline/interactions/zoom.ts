/**
 * Zoom/pan state for the timeline.
 *
 * Coordinate system:
 *  - Domain: absolute seconds since Golarian epoch (year 0, Abadius 1).
 *  - Range: pixel x within the viewport.
 *  - `centerSeconds` = the seconds-value rendered at viewport x = centerX.
 *  - `secondsPerPixel` = scale factor. Smaller = more zoomed in.
 */
export interface ViewState {
  centerSeconds: number;
  secondsPerPixel: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export function xToSeconds(x: number, view: ViewState, size: ViewportSize): number {
  const centerX = size.width / 2;
  return view.centerSeconds + (x - centerX) * view.secondsPerPixel;
}

export function secondsToX(seconds: number, view: ViewState, size: ViewportSize): number {
  const centerX = size.width / 2;
  return centerX + (seconds - view.centerSeconds) / view.secondsPerPixel;
}

/**
 * Zoom about a fixed pixel x — the seconds value at that x stays put.
 * Returns a new ViewState.
 */
export function zoomAbout(view: ViewState, size: ViewportSize, anchorX: number, factor: number): ViewState {
  const anchorSeconds = xToSeconds(anchorX, view, size);
  const newSecondsPerPixel = clampScale(view.secondsPerPixel * factor);
  // Solve: anchorSeconds = newCenter + (anchorX - centerX) * newSecondsPerPixel
  const centerX = size.width / 2;
  const newCenter = anchorSeconds - (anchorX - centerX) * newSecondsPerPixel;
  return { centerSeconds: newCenter, secondsPerPixel: newSecondsPerPixel };
}

export function panByPixels(view: ViewState, deltaPixels: number): ViewState {
  return {
    centerSeconds: view.centerSeconds - deltaPixels * view.secondsPerPixel,
    secondsPerPixel: view.secondsPerPixel,
  };
}

/** Clamp scale so we can't zoom past sensible limits. */
function clampScale(s: number): number {
  // Lower bound: 1 second per pixel (insanely zoomed in).
  // Upper bound: 30 days per pixel (far out).
  const MIN = 1;
  const MAX = 30 * 86400;
  return Math.max(MIN, Math.min(MAX, s));
}

export const SECONDS_PER_DAY = 86400;

/** Default: one day takes up ~200px */
export const DEFAULT_SECONDS_PER_PIXEL = SECONDS_PER_DAY / 200;
