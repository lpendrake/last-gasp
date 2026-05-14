import { useEffect, useRef, useState } from 'react';
import { timelinePort } from '../../timeline/data/ports';
import type { EventListItem, Palette, Session, State } from '../../timeline/data/types';
import {
  DEFAULT_SECONDS_PER_PIXEL,
  type ViewState,
  type ViewportSize,
} from '../../timeline/math/zoom';
import { Axis } from '../../timeline/render/Axis';

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
      }}
    >
      {loadedData.palette && (
        <Axis view={viewState} size={viewportSize} palette={loadedData.palette} />
      )}
      <div
        data-layer="session-layer"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      <div data-layer="cards-layer" style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
