/** Transitional aggregator that re-exports the per-entity adapter
 * modules under src/data/http/*. New code should import from those
 * modules directly; this file exists only so callers migrating off
 * the old monolithic api.ts have a single drop-in pivot point. */

export { ApiError } from './http/client.ts';
export type { EventWithMtime } from './ports.ts';

export {
  listEvents, getEvent, createEvent, updateEvent, deleteEvent,
} from './http/events.http.ts';

export {
  getState, putState, getTags, putTags, getPalette, putPalette,
  getSessions, appendSession,
} from './http/state.http.ts';

export { getLinkIndex, getFile } from './http/links.http.ts';

export {
  listNoteFolders, createNoteFolder, renameNoteFolder, deleteNoteFolder,
  listNotes, getNote, createNote, putNote, deleteNote, renameNote,
  uploadNoteAsset,
} from './http/notes.http.ts';
