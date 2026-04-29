import type {
  Event, EventListItem, EventFrontmatter, State, TagsRegistry,
  Session, Palette, LinkIndexEntry, NoteEntry,
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
  const res = await fetch(`/api/events/${encodeURIComponent(filename)}`, { cache: 'no-store' });
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

export async function getFile(relPath: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(
    `/api/file/${relPath.split('/').map(encodeURIComponent).join('/')}`,
    signal ? { signal } : undefined,
  );
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.text();
}

// ---- Notes CRUD ----

export async function listNoteFolders(): Promise<{ name: string }[]> {
  return jsonFetch<{ name: string }[]>('/api/notes');
}

export async function createNoteFolder(name: string): Promise<void> {
  const res = await fetch(`/api/notes/${encodeURIComponent(name)}`, { method: 'POST' });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

function noteUrl(folder: string, path: string) {
  return `/api/notes/${encodeURIComponent(folder)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function listNotes(folder: string): Promise<NoteEntry[]> {
  return jsonFetch<NoteEntry[]>(`/api/notes/${encodeURIComponent(folder)}`);
}

export async function getNote(folder: string, path: string): Promise<{ content: string; mtime: string }> {
  const res = await fetch(noteUrl(folder, path), { cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const content = await res.text();
  const mtime = res.headers.get('Last-Modified') ?? '';
  return { content, mtime };
}

export async function createNote(folder: string, path: string, content: string): Promise<string> {
  const res = await fetch(noteUrl(folder, path), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: content,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.headers.get('Last-Modified') ?? '';
}

export async function putNote(
  folder: string, path: string, content: string, ifUnmodifiedSince?: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (ifUnmodifiedSince) headers['If-Unmodified-Since'] = ifUnmodifiedSince;
  const res = await fetch(noteUrl(folder, path), { method: 'PUT', headers, body: content });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.headers.get('Last-Modified') ?? '';
}

export async function deleteNote(folder: string, path: string): Promise<void> {
  const res = await fetch(noteUrl(folder, path), { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

export async function renameNoteFolder(folder: string, newName: string): Promise<void> {
  const res = await fetch(`/api/notes/${encodeURIComponent(folder)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName }),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

export async function renameNote(
  folder: string, path: string, newPath: string, newFolder?: string,
): Promise<void> {
  const body: Record<string, string> = { newPath };
  if (newFolder && newFolder !== folder) body.newFolder = newFolder;
  const res = await fetch(noteUrl(folder, path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

export async function deleteNoteFolder(folder: string): Promise<void> {
  const res = await fetch(`/api/notes/${encodeURIComponent(folder)}`, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

export async function uploadNoteAsset(
  folder: string, filename: string, data: ArrayBuffer, mimeType: string,
): Promise<string> {
  const url = `/api/notes/${encodeURIComponent(folder)}/assets/${encodeURIComponent(filename)}`;
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: data });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const json = await res.json() as { path: string };
  return json.path;
}
