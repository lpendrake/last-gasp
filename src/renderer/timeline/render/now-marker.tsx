import type { ReactElement, MouseEvent } from 'react';
import './now-marker.css';
import type { ViewState, ViewportSize } from '../math/zoom';
import { secondsToX } from '../math/zoom';
import { parseISOString } from '../calendar/golarian';
import { formatNowMarker } from '../calendar/format';

export interface NowMarkerLayout {
  x: number;
  labelTop: number;
  dayMonth: string;
  year: string;
  time: string | null;
}

/**
 * Returns null when the marker is offscreen or the viewport is unmeasured;
 * otherwise the screen-space data needed to render the marker.
 *
 * Pure — exported for tests.
 */
export function computeNowMarkerLayout(
  view: ViewState,
  size: ViewportSize,
  inGameNow: string,
  inGameNowSeconds: number,
): NowMarkerLayout | null {
  if (size.width === 0 || size.height === 0) return null;

  const x = secondsToX(inGameNowSeconds, view, size);
  if (x < 0 || x > size.width) return null;

  const axisY = Math.floor(size.height * 0.8);
  const [dayMonth, year, time] = formatNowMarker(parseISOString(inGameNow));

  return {
    x,
    // Sit below the month label band (which starts at axisY+64 and is ~35px tall).
    labelTop: axisY + 108,
    dayMonth,
    year,
    time,
  };
}

interface NowMarkerProps {
  view: ViewState;
  size: ViewportSize;
  inGameNow: string;
  inGameNowSeconds: number;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
}

export function NowMarker({
  view,
  size,
  inGameNow,
  inGameNowSeconds,
  onContextMenu,
}: NowMarkerProps): ReactElement | null {
  const layout = computeNowMarkerLayout(view, size, inGameNow, inGameNowSeconds);
  if (layout === null) return null;

  return (
    <div className="now-marker" style={{ left: layout.x }}>
      <div
        className="now-marker-labels"
        style={{ top: layout.labelTop }}
        onContextMenu={onContextMenu}
        title={onContextMenu ? 'Right-click to advance time' : undefined}
      >
        <div className="now-marker-date">{layout.dayMonth}</div>
        <div className="now-marker-year">{layout.year}</div>
        {layout.time !== null && <div className="now-marker-time">{layout.time}</div>}
      </div>
    </div>
  );
}
