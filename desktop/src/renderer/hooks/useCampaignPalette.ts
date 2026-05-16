import { useEffect, useState } from 'react';
import type { Palette } from '../timeline/data/types';
import { timelinePort } from '../timeline/data/ports';

export function useCampaignPalette(campaignPath: string | null): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);

  useEffect(() => {
    if (!campaignPath) {
      setPalette(null);
      return;
    }
    let cancelled = false;
    timelinePort
      .loadPalette(campaignPath)
      .then((p) => {
        if (!cancelled) setPalette(p);
      })
      .catch((err) => console.error('[useCampaignPalette] failed to load palette', err));
    return () => {
      cancelled = true;
    };
  }, [campaignPath]);

  return palette;
}
