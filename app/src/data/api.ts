import type {
  Event, EventListItem, EventFrontmatter, State, TagsRegistry,
  Session, Palette, LinkIndexEntry,
} from './types.ts';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

// ---- Events ----

export async function listEvents(): Promise<EventListItem[]> {
  return jsonFetch<EventListItem[]>('/api/events');
}

export interface EventWithMtime extends Event {
  /** mtime returned as Last-Modified header, used for If-Unmodified-Since on PUT/DELETE */
  lastModified: string;
}

export async function getEvent(filename: string): Promise<EventWithMtime> {
  const res = await fetch(`/api/events/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const event = await res.json() as Event;
  const lastModified = res.headers.get('Last-Modified') ?? event.mtime;
  return { ...event, lastModified };
}

export async function createEvent(
  filename: string,
  frontmatter: EventFrontmatter,
  body: string,
): Promise<EventWithMtime> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, frontmatter, body }),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const event = await res.json() as Event;
  const lastModified = res.headers.get('Last-Modified') ?? event.mtime;
  return { ...event, lastModified };
}

export async function updateEvent(
  filename: string,
  frontmatter: EventFrontmatter,
  body: string,
  ifUnmodifiedSince: string,
): Promise<EventWithMtime> {
  const res = await fetch(`/api/events/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Unmodified-Since': ifUnmodifiedSince,
    },
    body: JSON.stringify({ frontmatter, body }),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const event = await res.json() as Event;
  const lastModified = res.headers.get('Last-Modified') ?? event.mtime;
  return { ...event, lastModified };
}

export async function deleteEvent(filename: string, ifUnmodifiedSince: string): Promise<void> {
  const res = await fetch(`/api/events/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { 'If-Unmodified-Since': ifUnmodifiedSince },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// ---- State / Tags / Palette / Sessions ----

export const getState   = () => jsonFetch<State>('/api/state');
export const putState   = (s: State) => jsonFetch<{ ok: true }>('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
export const getTags    = () => jsonFetch<TagsRegistry>('/api/tags');
export const putTags    = (t: TagsRegistry) => jsonFetch<{ ok: true }>('/api/tags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
export const getPalette = () => jsonFetch<Palette>('/api/palette');
export const putPalette = (p: Palette) => jsonFetch<{ ok: true }>('/api/palette', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
export const getSessions = () => jsonFetch<Session[]>('/api/sessions');
export const appendSession = (s: Session) => jsonFetch<Session[]>('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });

// ---- Link index + file peek ----

export const getLinkIndex = () => jsonFetch<LinkIndexEntry[]>('/api/link-index');

export async function getFile(relPath: string): Promise<string> {
  const res = await fetch(`/api/file/${relPath.split('/').map(encodeURIComponent).join('/')}`);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.text();
}
