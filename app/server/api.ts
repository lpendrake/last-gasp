// Composition root for the server. The only file where adapters meet
// handlers; per app/server/AGENTS.md every other layer depends on
// ports (data/ports.ts, git/port.ts) and lets this file pick the
// concrete implementation.
import type { Connect, ViteDevServer, Plugin } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendError } from './http/responses.ts';
import { dispatch, type Route } from './http/router.ts';
import { makeFsEventStore } from './data/fs/events.fs.ts';
import { makeFsStateStore } from './data/fs/state.fs.ts';
import { makeFsEventTrashStore } from './data/fs/trash.fs.ts';
import { makeFsNoteStore } from './data/fs/notes.fs.ts';
import { makeExecGitPort } from './git/exec.ts';
import { eventRoutes } from './http/events.routes.ts';
import { stateRoutes } from './http/state.routes.ts';
import { trashRoutes } from './http/trash.routes.ts';
import { noteRoutes } from './http/notes.routes.ts';
import { gitRoutes } from './http/git.routes.ts';

export type ApiHandler = (req: Connect.IncomingMessage, res: any, next?: (err?: any) => void) => Promise<void> | void;

export interface CreateApiOpts {
  repoRoot: string;
}

/** Build the API middleware for a given repo root. The test suite
 * calls this against a temp directory; production wiring is in
 * `apiPlugin`. */
export function createApi(opts: CreateApiOpts): ApiHandler {
  const REPO_ROOT = resolve(opts.repoRoot);

  // Adapters
  const events = makeFsEventStore(REPO_ROOT);
  const state = makeFsStateStore(REPO_ROOT);
  const trash = makeFsEventTrashStore(REPO_ROOT);
  const notes = makeFsNoteStore(REPO_ROOT);
  const git = makeExecGitPort(REPO_ROOT);

  // Routes
  const ROUTES: Route[] = [
    ...eventRoutes({ events }),
    ...stateRoutes({ state }),
    ...trashRoutes({ events, trash }),
    ...noteRoutes({ notes }),
    ...gitRoutes({ git }),
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
