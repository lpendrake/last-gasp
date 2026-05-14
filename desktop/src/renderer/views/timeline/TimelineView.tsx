import { useEffect, useRef, useState } from 'react';
import { timelinePort } from '../../timeline/data/ports';
import type { EventListItem, Palette, Session, State } from '../../timeline/data/types';
import {
  DEFAULT_SECONDS_PER_PIXEL,
  type ViewState,
  type ViewportSize,
} from '../../timeline/math/zoom';
import { parseISOString, toAbsoluteSeconds } from '../../timeline/calendar/golarian';
import { paletteToCssVars } from '../../timeline/palette';
import { Axis } from '../../timeline/render/Axis';
import { Cards } from '../../timeline/render/Cards.tsx';
import { NowMarker } from '../../timeline/render/NowMarker';

interface TimelineViewProps {
  campaignPath: string;
}

interface LoadedData {
  palette: Palette | null;
  gameState: State | null;
  events: EventListItem[];
  sessions: Session[];
}

export function TimelineView({ campaignPath }: TimelineViewProps) {
  const [viewState] = useState<ViewState>({
    centerSeconds: 0,
    secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL,
  });
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [loadedData, setLoadedData] = useState<LoadedData>({
    palette: null,
    gameState: null,
    events: [],
    sessions: [],
  });

  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { contentRect } = entries[0];
      setViewportSize({ width: contentRect.width, height: contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // gameState/events/sessions pre-wired here; consumed by render layers in follow-up issues.
    Promise.all([
      timelinePort.loadPalette(campaignPath),
      timelinePort.getState(campaignPath),
      timelinePort.listEvents(campaignPath),
      timelinePort.getSessions(campaignPath),
    ])
      .then(([palette, gameState, events, sessions]) => {
        if (!cancelled) setLoadedData({ palette, gameState, events, sessions });
      })
      .catch((err) => console.error('[TimelineView] failed to load campaign data', err));
    return () => {
      cancelled = true;
    };
  }, [campaignPath]);

  const bgColor = loadedData.palette?.theme.background ?? '#09090b';
  const inGameNow = loadedData.gameState?.in_game_now || null;
  const inGameNowSeconds = inGameNow ? toAbsoluteSeconds(parseISOString(inGameNow)) : Infinity;

  return (
    <div
      ref={viewportRef}
      data-timeline-viewport
      data-width={viewportSize.width}
      data-height={viewportSize.height}
      data-center={viewState.centerSeconds}
      data-scale={viewState.secondsPerPixel}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: bgColor,
        overflow: 'hidden',
        ...(loadedData.palette ? paletteToCssVars(loadedData.palette) : {}),
      }}
    >
      {loadedData.palette && <Axis view={viewState} size={viewportSize} />}
      <div
        data-layer="session-layer"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      {loadedData.palette && (
        <Cards
          events={loadedData.events}
          view={viewState}
          size={viewportSize}
          palette={loadedData.palette}
          inGameNowSeconds={inGameNowSeconds}
        />
      )}
      {loadedData.palette && inGameNow && (
        <NowMarker
          view={viewState}
          size={viewportSize}
          inGameNow={inGameNow}
          inGameNowSeconds={inGameNowSeconds}
        />
      )}
    </div>
  );
}
