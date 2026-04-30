import type { StateStore, StateName } from '../data/ports.ts';
import { sendJson, sendError } from './responses.ts';
import { readBody } from './body.ts';
import { defineRoute, type Route } from './router.ts';
import { ValidationError } from '../domain/errors.ts';
import { appendSession } from '../domain/state.ts';

interface Deps { state: StateStore }

function jsonFileGet(state: StateStore, name: StateName) {
  return async (_req: any, res: any) => {
    const content = await state.read(name);
    if (content === null) return sendError(res, 404, `${name}.json not found`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(content);
  };
}

function jsonFilePut(state: StateStore, name: StateName) {
  return async (req: any, res: any) => {
    const body = await readBody(req);
    await state.write(name, JSON.stringify(body, null, 2) + '\n');
    sendJson(res, 200, { ok: true });
  };
}

export function stateRoutes(deps: Deps): Route[] {
  return [
    defineRoute('GET', '/api/state',    jsonFileGet(deps.state, 'state')),
    defineRoute('PUT', '/api/state',    jsonFilePut(deps.state, 'state')),
    defineRoute('GET', '/api/tags',     jsonFileGet(deps.state, 'tags')),
    defineRoute('PUT', '/api/tags',     jsonFilePut(deps.state, 'tags')),
    defineRoute('GET', '/api/palette',  jsonFileGet(deps.state, 'palette')),
    defineRoute('PUT', '/api/palette',  jsonFilePut(deps.state, 'palette')),
    defineRoute('GET', '/api/sessions', jsonFileGet(deps.state, 'sessions')),
    defineRoute('POST', '/api/sessions', async (req, res) => {
      const newSession = await readBody(req);
      try {
        const list = await appendSession(deps.state, newSession);
        sendJson(res, 200, list);
      } catch (err) {
        if (err instanceof ValidationError) return sendError(res, 400, err.message);
        throw err;
      }
    }),
  ];
}
