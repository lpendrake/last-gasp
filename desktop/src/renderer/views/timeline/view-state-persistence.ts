import type { ViewState } from '../../timeline/math/zoom';

function persistenceKey(campaignPath: string): string {
  return `timeline-view:${campaignPath}`;
}

export function loadSavedViewState(campaignPath: string): ViewState | null {
  try {
    const raw = localStorage.getItem(persistenceKey(campaignPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'centerSeconds' in parsed &&
      'secondsPerPixel' in parsed &&
      typeof (parsed as ViewState).centerSeconds === 'number' &&
      typeof (parsed as ViewState).secondsPerPixel === 'number'
    ) {
      return parsed as ViewState;
    }
  } catch {
    // ignore malformed data
  }
  return null;
}

export function saveViewState(campaignPath: string, view: ViewState): void {
  try {
    localStorage.setItem(persistenceKey(campaignPath), JSON.stringify(view));
  } catch {
    // ignore storage errors
  }
}
