import type { Event, EventListItem, EventFrontmatter } from '../types.ts';
import type { EventWithMtime } from '../ports.ts';
import { ApiError, jsonFetch } from './client.ts';

export async function listEvents(): Promise<EventListItem[]> {
  return jsonFetch<EventListItem[]>('/api/events');
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
