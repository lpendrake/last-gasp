import type { Connect } from 'vite';
import { sendError } from './responses.ts';

export type RouteHandler = (
  req: Connect.IncomingMessage,
  res: any,
  params: Record<string, string>,
) => Promise<void>;

export interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * Compile a path pattern with `:param` (single segment) or `:param*`
 * (greedy, slashes allowed) into a Route descriptor.
 */
export function defineRoute(method: string, path: string, handler: RouteHandler): Route {
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([a-zA-Z_]+)(\*)?/g, (_m, name, star) => {
    paramNames.push(name);
    return star ? '(.+)' : '([^/]+)';
  });
  return {
    method,
    pattern: new RegExp(`^${regexStr}$`),
    paramNames,
    handler,
  };
}

/**
 * Dispatch an incoming request against a route table. Calls the first
 * matching handler, or sends 404 if none match. Wraps each handler in
 * a try/catch that returns 500 on uncaught errors.
 */
export async function dispatch(
  routes: Route[],
  req: Connect.IncomingMessage,
  res: any,
): Promise<void> {
  const url = (req.url ?? '').split('?')[0];
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = url.match(r.pattern);
    if (!match) continue;
    const params: Record<string, string> = {};
    r.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
    try {
      await r.handler(req, res, params);
    } catch (err: any) {
      console.error('[api] handler error', r.method, url, err);
      if (!res.headersSent) sendError(res, 500, err.message ?? String(err));
    }
    return;
  }
  sendError(res, 404, `No route for ${req.method} ${url}`);
}
