import type { EventStore, EventTrashStore } from '../data/ports.ts';
import { sendJson, sendError } from './responses.ts';
import { defineRoute, type Route } from './router.ts';
import { ConflictError, NotFoundError } from '../domain/errors.ts';
import {
  listTrash, restoreTrash, deleteTrashEntry, emptyTrash,
} from '../domain/trash.ts';

interface Deps { events: EventStore; trash: EventTrashStore }

function mapError(res: any, err: unknown): boolean {
  if (err instanceof NotFoundError) { sendError(res, 404, err.message); return true; }
  if (err instanceof ConflictError) { sendError(res, 409, err.message); return true; }
  return false;
}

export function trashRoutes(deps: Deps): Route[] {
  return [
    defineRoute('GET', '/api/trash', async (_req, res) => {
      sendJson(res, 200, await listTrash(deps.trash));
    }),

    defineRoute('POST', '/api/trash/:filename/restore', async (_req, res, params) => {
      const filename = decodeURIComponent(params.filename);
      try {
        sendJson(res, 200, await restoreTrash(deps.trash, deps.events, filename));
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('DELETE', '/api/trash/:filename', async (_req, res, params) => {
      const filename = decodeURIComponent(params.filename);
      try {
        await deleteTrashEntry(deps.trash, filename);
        sendJson(res, 200, { ok: true });
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('DELETE', '/api/trash', async (_req, res) => {
      await emptyTrash(deps.trash);
      sendJson(res, 200, { ok: true });
    }),
  ];
}
