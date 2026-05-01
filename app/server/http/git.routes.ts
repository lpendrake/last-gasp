import type { GitPort } from '../git/port.ts';
import { sendJson, sendError } from './responses.ts';
import { readBody } from './body.ts';
import { defineRoute, type Route } from './router.ts';

interface Deps { git: GitPort }

export function gitRoutes(deps: Deps): Route[] {
  return [
    defineRoute('GET', '/api/git/status', async (_req, res) => {
      try {
        const output = await deps.git.status();
        sendJson(res, 200, { output });
      } catch (err: any) {
        sendError(res, 500, err.message);
      }
    }),

    defineRoute('POST', '/api/git/commit', async (req, res) => {
      const body = await readBody(req);
      const message = body?.message;
      if (!message || typeof message !== 'string') {
        return sendError(res, 400, 'Missing message');
      }
      try {
        await deps.git.commit(message);
        sendJson(res, 200, { ok: true });
      } catch (err: any) {
        sendError(res, 500, err.message);
      }
    }),
  ];
}
