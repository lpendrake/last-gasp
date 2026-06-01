import { zoomAbout, panByPixels } from '../math/zoom';
import type { ViewState, ViewportSize } from '../math/zoom';

/** Factor applied per keypress when zooming in (shrinks secondsPerPixel). */
export const ZOOM_STEP_IN = 0.8;

/** Factor applied per keypress when zooming out (grows secondsPerPixel). */
export const ZOOM_STEP_OUT = 1.25;

/** Fixed pixels panned per keypress. */
export const PAN_STEP_PX = 150;

/**
 * Zoom the timeline in or out, anchored at the viewport centre.
 * Delegates entirely to `zoomAbout` — no math reimplemented here.
 */
export function keyboardZoom(view: ViewState, size: ViewportSize, dir: 'in' | 'out'): ViewState {
  const anchorX = size.width / 2;
  const factor = dir === 'in' ? ZOOM_STEP_IN : ZOOM_STEP_OUT;
  return zoomAbout(view, size, anchorX, factor);
}

/**
 * Pan the timeline earlier or later by a fixed pixel step.
 *
 * `panByPixels` computes: centerSeconds - deltaPixels * secondsPerPixel
 * - To increase centerSeconds (later), deltaPixels must be negative.
 * - To decrease centerSeconds (earlier), deltaPixels must be positive.
 *
 * Delegates entirely to `panByPixels` — no math reimplemented here.
 */
export function keyboardPan(view: ViewState, dir: 'earlier' | 'later'): ViewState {
  const deltaPixels = dir === 'later' ? -PAN_STEP_PX : PAN_STEP_PX;
  return panByPixels(view, deltaPixels);
}
