import type { State, TagsRegistry, Session, Palette } from '../types.ts';
import { jsonFetch } from './client.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const getState   = () => jsonFetch<State>('/api/state');
export const putState   = (s: State) => jsonFetch<{ ok: true }>('/api/state', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(s) });

export const getTags    = () => jsonFetch<TagsRegistry>('/api/tags');
export const putTags    = (t: TagsRegistry) => jsonFetch<{ ok: true }>('/api/tags', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(t) });

export const getPalette = () => jsonFetch<Palette>('/api/palette');
export const putPalette = (p: Palette) => jsonFetch<{ ok: true }>('/api/palette', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(p) });

export const getSessions   = () => jsonFetch<Session[]>('/api/sessions');
export const appendSession = (s: Session) => jsonFetch<Session[]>('/api/sessions', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(s) });
