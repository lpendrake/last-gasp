import type { NoteEntry } from '../types.ts';
import { ApiError, jsonFetch } from './client.ts';

function noteUrl(folder: string, path: string) {
  return `/api/notes/${encodeURIComponent(folder)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// ---- Folders ----

export async function listNoteFolders(): Promise<{ name: string }[]> {
  return jsonFetch<{ name: string }[]>('/api/notes');
}

export async function createNoteFolder(name: string): Promise<void> {
  const res = await fetch(`/api/notes/${encodeURIComponent(name)}`, { method: 'POST' });
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

export async function deleteNoteFolder(folder: string): Promise<void> {
  const res = await fetch(`/api/notes/${encodeURIComponent(folder)}`, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// ---- Files ----

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

// ---- Assets ----

export async function uploadNoteAsset(
  folder: string, filename: string, data: ArrayBuffer, mimeType: string,
): Promise<string> {
  const url = `/api/notes/${encodeURIComponent(folder)}/assets/${encodeURIComponent(filename)}`;
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: data });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const json = await res.json() as { path: string };
  return json.path;
}
