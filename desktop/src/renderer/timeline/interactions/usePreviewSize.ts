import { useState, useCallback } from 'react';

const PREVIEW_SIZE_KEY = 'preview-card-size';
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

export interface PreviewSize {
  width: number;
  expandedHeight: number;
}

export function loadPreviewSize(): PreviewSize {
  try {
    const raw = localStorage.getItem(PREVIEW_SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'width' in parsed &&
        'expandedHeight' in parsed &&
        typeof (parsed as Record<string, unknown>).width === 'number' &&
        typeof (parsed as Record<string, unknown>).expandedHeight === 'number'
      ) {
        return parsed as PreviewSize;
      }
    }
  } catch {
    // ignore corrupt or missing storage
  }
  return { width: DEFAULT_WIDTH, expandedHeight: DEFAULT_HEIGHT };
}

export function usePreviewSize(): [PreviewSize, (s: PreviewSize) => void] {
  const [size, setSize] = useState<PreviewSize>(loadPreviewSize);

  const save = useCallback((s: PreviewSize) => {
    try {
      localStorage.setItem(PREVIEW_SIZE_KEY, JSON.stringify(s));
    } catch {
      // ignore quota errors
    }
    setSize(s);
  }, []);

  return [size, save];
}
