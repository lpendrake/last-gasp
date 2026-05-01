// NOTE FOR AGENTS: do not extend this file. New server code goes in
// app/server/{http,domain,data}/* per the layer rules in
// app/server/AGENTS.md. Run the `add-api-route` skill before adding
// or modifying endpoints.
import type { Connect, ViteDevServer, Plugin } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { sendJson, sendError } from './http/responses.ts';
import { readBody } from './http/body.ts';
import { defineRoute, dispatch, type RouteHandler, type Route } from './http/router.ts';
import { makeFsEventStore } from './data/fs/events.fs.ts';
import { makeFsStateStore } from './data/fs/state.fs.ts';
import { makeFsEventTrashStore } from './data/fs/trash.fs.ts';
import { makeFsNoteStore } from './data/fs/notes.fs.ts';
import { eventRoutes } from './http/events.routes.ts';
import { stateRoutes } from './http/state.routes.ts';
import { trashRoutes } from './http/trash.routes.ts';
import { noteRoutes } from './http/notes.routes.ts';

export type ApiHandler = (req: Connect.IncomingMessage, res: any, next?: (err?: any) => void) => Promise<void> | void;

export interface CreateApiOpts {
  repoRoot: string;
}

/**
 * Build the API middleware for a given repo root.
 * Extracted so tests can point it at a temp directory.
 */
export function createApi(opts: CreateApiOpts): ApiHandler {
  const REPO_ROOT = resolve(opts.repoRoot);

  function execGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd: REPO_ROOT }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }

  const events = makeFsEventStore(REPO_ROOT);
  const state = makeFsStateStore(REPO_ROOT);
  const trash = makeFsEventTrashStore(REPO_ROOT);
  const notes = makeFsNoteStore(REPO_ROOT);
  const eventRouteList = eventRoutes({ events });
  const stateRouteList = stateRoutes({ state });
  const trashRouteList = trashRoutes({ events, trash });
  const noteRouteList = noteRoutes({ notes });

  const gitStatus: RouteHandler = async (_req, res) => {
    try {
      const out = await execGit(['status', '--short']);
      sendJson(res, 200, { output: out });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  };

  const gitCommit: RouteHandler = async (req, res) => {
    const body = await readBody(req);
    const message = body?.message;
    if (!message || typeof message !== 'string') {
      return sendError(res, 400, 'Missing message');
    }
    try {
      await execGit(['add', '-A']);
      await execGit(['commit', '-m', message]);
      sendJson(res, 200, { ok: true });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  };

  const ROUTES: Route[] = [
    ...eventRouteList,
    ...stateRouteList,
    ...trashRouteList,
    ...noteRouteList,
    defineRoute('GET',    '/api/git/status',                gitStatus),
    defineRoute('POST',   '/api/git/commit',                gitCommit),
  ];

  return async function handler(req, res, next) {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/api/')) {
      if (next) return next();
      return sendError(res, 404, 'Not found');
    }
    await dispatch(ROUTES, req, res);
  };
}

/** Default repo root for production: two directories up from this file. */
function defaultRepoRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), '..', '..');
}

export function apiPlugin(): Plugin {
  return {
    name: 'last-gasp-api',
    configureServer(server: ViteDevServer) {
      const handler = createApi({ repoRoot: defaultRepoRoot() });
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith('/api/')) return next();
        await handler(req, res, next);
      });
    },
  };
}
