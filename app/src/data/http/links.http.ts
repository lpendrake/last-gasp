import type { LinkIndexEntry } from '../types.ts';
import { ApiError, jsonFetch } from './client.ts';

/** All known notes/events for the @-mention link picker and hover-peek. */
export const getLinkIndex = () => jsonFetch<LinkIndexEntry[]>('/api/link-index');

/** Read any md or image by repo-relative path (used by hover-peek). */
export async function getFile(relPath: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(
    `/api/file/${relPath.split('/').map(encodeURIComponent).join('/')}`,
    signal ? { signal } : undefined,
  );
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.text();
}
