import type { EventStore } from '../data/ports.ts';
import { sendJson, sendError } from './responses.ts';
import { readBody } from './body.ts';
import { defineRoute, type Route } from './router.ts';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.ts';
import {
  listEvents, getEvent, createEvent, updateEvent, deleteEvent,
} from '../domain/events.ts';

interface Deps { events: EventStore }

function mapDomainError(res: any, err: unknown): boolean {
  if (err instanceof ValidationError) { sendError(res, 400, err.message); return true; }
  if (err instanceof NotFoundError)   { sendError(res, 404, err.message); return true; }
  if (err instanceof ConflictError)   { sendError(res, 409, err.message); return true; }
  return false;
}

export function eventRoutes(deps: Deps): Route[] {
  return [
    defineRoute('GET', '/api/events', async (_req, res) => {
      const items = await listEvents(deps.events);
      sendJson(res, 200, items);
    }),

    defineRoute('GET', '/api/events/:filename', async (_req, res, params) => {
      const filename = decodeURIComponent(params.filename);
      try {
        const { event, mtime } = await getEvent(deps.events, filename);
        sendJson(res, 200, event, { 'Last-Modified': mtime.toUTCString() });
      } catch (err) {
        if (!mapDomainError(res, err)) throw err;
      }
    }),

    defineRoute('POST', '/api/events', async (req, res) => {
      const body = await readBody(req);
      if (!body || !body.filename || !body.frontmatter) {
        return sendError(res, 400, 'Missing filename or frontmatter');
      }
      try {
        const { event, mtime } = await createEvent(deps.events, body.filename, body.frontmatter, body.body ?? '');
        sendJson(res, 201, event, { 'Last-Modified': mtime.toUTCString() });
      } catch (err) {
        if (!mapDomainError(res, err)) throw err;
      }
    }),

    defineRoute('PUT', '/api/events/:filename', async (req, res, params) => {
      const filename = decodeURIComponent(params.filename);
      const body = await readBody(req);
      if (!body || !body.frontmatter) return sendError(res, 400, 'Missing frontmatter');
      const ius = req.headers['if-unmodified-since'] as string | undefined;
      try {
        const { event, mtime } = await updateEvent(deps.events, filename, body.frontmatter, body.body ?? '', ius);
        sendJson(res, 200, event, { 'Last-Modified': mtime.toUTCString() });
      } catch (err) {
        if (!mapDomainError(res, err)) throw err;
      }
    }),

    defineRoute('DELETE', '/api/events/:filename', async (req, res, params) => {
      const filename = decodeURIComponent(params.filename);
      const ius = req.headers['if-unmodified-since'] as string | undefined;
      try {
        const result = await deleteEvent(deps.events, filename, ius);
        sendJson(res, 200, result);
      } catch (err) {
        if (!mapDomainError(res, err)) throw err;
      }
    }),
  ];
}
