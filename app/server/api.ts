import type { Connect, ViteDevServer, Plugin } from 'vite';
import { promises as fs } from 'fs';
import { join, resolve, relative, basename, sep, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { writeFileAtomic } from './fs-atomic.ts';
import type {
  Event, EventListItem, EventFrontmatter, LinkIndexEntry,
} from '../src/data/types.ts';

// Custom YAML engine for gray-matter that does NOT parse ISO-style strings as Date objects.
// Golarian years like 4726 aren't meaningful as JS Dates, and we want date strings preserved.
const yamlEngine = {
  parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
  stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
};
const MATTER_OPTIONS = { engines: { yaml: yamlEngine } };

export type ApiHandler = (req: Connect.IncomingMessage, res: any, next?: (err?: any) => void) => Promise<void> | void;

export interface CreateApiOpts {
  repoRoot: string;
}

type RouteHandler = (req: Connect.IncomingMessage, res: any, params: Record<string, string>) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

function defineRoute(method: string, path: string, handler: RouteHandler): Route {
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

function sendJson(res: any, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function sendError(res: any, status: number, message: string) {
  sendJson(res, status, { error: message });
}

async function readBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8');
      if (!text) return resolve(null);
      try {
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function serialiseEvent(fm: EventFrontmatter, body: string): string {
  return matter.stringify(body, fm as any, MATTER_OPTIONS);
}

function parseEventFile(content: string): { fm: EventFrontmatter; body: string } {
  const parsed = matter(content, MATTER_OPTIONS);
  const fm = parsed.data as EventFrontmatter;
  return { fm, body: parsed.content };
}

function eventFromParsed(filename: string, content: string, mtime: Date): Event {
  const { fm, body } = parseEventFile(content);
  return { ...fm, filename, body, mtime: mtime.toUTCString() };
}

function eventListItemFromParsed(filename: string, content: string, mtime: Date): EventListItem {
  const { fm } = parseEventFile(content);
  return { ...fm, filename, mtime: mtime.toUTCString() };
}

/** Compare mtimes at second resolution (HTTP date precision). */
function mtimeMatch(headerValue: string, stat: { mtime: Date }): boolean {
  const clientMs = new Date(headerValue).getTime();
  const serverMs = stat.mtime.getTime();
  return Math.floor(clientMs / 1000) === Math.floor(serverMs / 1000);
}

const SCAN_DIRS = ['events', 'npcs', 'factions', 'locations', 'plots', 'sessions', 'rules', 'player-facing', 'misc'];
const typeByDir: Record<string, LinkIndexEntry['type']> = {
  events: 'event',
  npcs: 'npc',
  factions: 'faction',
  locations: 'location',
  plots: 'plot',
  sessions: 'session',
  rules: 'rule',
  'player-facing': 'player-facing',
  misc: 'misc',
};

async function extractTitle(filepath: string): Promise<string> {
  const content = await fs.readFile(filepath, 'utf-8');
  try {
    const parsed = matter(content, MATTER_OPTIONS);
    if (parsed.data && typeof (parsed.data as any).title === 'string') {
      return (parsed.data as any).title;
    }
    const m = parsed.content.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    const m = content.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  }
  return basename(filepath, '.md');
}

/**
 * Build the API middleware for a given repo root.
 * Extracted so tests can point it at a temp directory.
 */
export function createApi(opts: CreateApiOpts): ApiHandler {
  const REPO_ROOT = resolve(opts.repoRoot);
  const EVENTS_DIR = join(REPO_ROOT, 'events');
  const TRASH_DIR = join(EVENTS_DIR, '.trash');

  async function ensureTrashDir() {
    await fs.mkdir(TRASH_DIR, { recursive: true });
  }

  function safeResolveInRepo(relPath: string): string | null {
    if (relPath.includes('..')) return null;
    const absolute = resolve(REPO_ROOT, relPath);
    const relCheck = relative(REPO_ROOT, absolute);
    if (relCheck.startsWith('..') || relCheck.startsWith(sep + '..')) return null;
    return absolute;
  }

  function execGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd: REPO_ROOT }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }

  const listEvents: RouteHandler = async (_req, res) => {
    if (!(await fileExists(EVENTS_DIR))) {
      return sendJson(res, 200, []);
    }
    await ensureTrashDir();
    const files = await fs.readdir(EVENTS_DIR);
    const events: EventListItem[] = [];
    for (const filename of files) {
      if (!filename.endsWith('.md') || filename === 'README.md') continue;
      const filepath = join(EVENTS_DIR, filename);
      const stat = await fs.stat(filepath);
      if (!stat.isFile()) continue;
      const content = await fs.readFile(filepath, 'utf-8');
      events.push(eventListItemFromParsed(filename, content, stat.mtime));
    }
    sendJson(res, 200, events);
  };

  const getEvent: RouteHandler = async (_req, res, params) => {
    const filename = decodeURIComponent(params.filename);
    if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('\\')) {
      return sendError(res, 400, 'Invalid filename');
    }
    const filepath = join(EVENTS_DIR, filename);
    if (!(await fileExists(filepath))) return sendError(res, 404, 'Event not found');
    const stat = await fs.stat(filepath);
    const content = await fs.readFile(filepath, 'utf-8');
    sendJson(res, 200, eventFromParsed(filename, content, stat.mtime), {
      'Last-Modified': stat.mtime.toUTCString(),
    });
  };

  const createEvent: RouteHandler = async (req, res) => {
    const body = await readBody(req);
    if (!body || !body.filename || !body.frontmatter) {
      return sendError(res, 400, 'Missing filename or frontmatter');
    }
    const filename: string = body.filename;
    if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('\\')) {
      return sendError(res, 400, 'Invalid filename');
    }
    await fs.mkdir(EVENTS_DIR, { recursive: true });
    const filepath = join(EVENTS_DIR, filename);
    if (await fileExists(filepath)) {
      return sendError(res, 409, 'Event already exists');
    }
    const content = serialiseEvent(body.frontmatter, body.body ?? '');
    await writeFileAtomic(filepath, content);
    const stat = await fs.stat(filepath);
    sendJson(res, 201, eventFromParsed(filename, content, stat.mtime), {
      'Last-Modified': stat.mtime.toUTCString(),
    });
  };

  const updateEvent: RouteHandler = async (req, res, params) => {
    const filename = decodeURIComponent(params.filename);
    if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('\\')) {
      return sendError(res, 400, 'Invalid filename');
    }
    const filepath = join(EVENTS_DIR, filename);
    if (!(await fileExists(filepath))) return sendError(res, 404, 'Event not found');

    const stat = await fs.stat(filepath);
    const ifUnmodifiedSince = req.headers['if-unmodified-since'];
    if (ifUnmodifiedSince && !mtimeMatch(ifUnmodifiedSince as string, stat)) {
      return sendError(res, 409, 'File modified since last read');
    }

    const body = await readBody(req);
    if (!body || !body.frontmatter) return sendError(res, 400, 'Missing frontmatter');

    const content = serialiseEvent(body.frontmatter, body.body ?? '');
    await writeFileAtomic(filepath, content);
    const newStat = await fs.stat(filepath);
    sendJson(res, 200, eventFromParsed(filename, content, newStat.mtime), {
      'Last-Modified': newStat.mtime.toUTCString(),
    });
  };

  const deleteEvent: RouteHandler = async (req, res, params) => {
    const filename = decodeURIComponent(params.filename);
    if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('\\')) {
      return sendError(res, 400, 'Invalid filename');
    }
    const filepath = join(EVENTS_DIR, filename);
    if (!(await fileExists(filepath))) return sendError(res, 404, 'Event not found');

    const stat = await fs.stat(filepath);
    const ifUnmodifiedSince = req.headers['if-unmodified-since'];
    if (ifUnmodifiedSince && !mtimeMatch(ifUnmodifiedSince as string, stat)) {
      return sendError(res, 409, 'File modified since last read');
    }

    await ensureTrashDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trashName = `${timestamp}-${filename}`;
    const trashPath = join(TRASH_DIR, trashName);
    await fs.rename(filepath, trashPath);
    sendJson(res, 200, { trashedAs: trashName });
  };

  function makeJsonFileHandler(filename: string) {
    const filepath = join(REPO_ROOT, filename);
    const get: RouteHandler = async (_req, res) => {
      if (!(await fileExists(filepath))) return sendError(res, 404, `${filename} not found`);
      const content = await fs.readFile(filepath, 'utf-8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(content);
    };
    const put: RouteHandler = async (req, res) => {
      const body = await readBody(req);
      await writeFileAtomic(filepath, JSON.stringify(body, null, 2) + '\n');
      sendJson(res, 200, { ok: true });
    };
    return { get, put };
  }

  const stateHandlers = makeJsonFileHandler('state.json');
  const tagsHandlers = makeJsonFileHandler('tags.json');
  const paletteHandlers = makeJsonFileHandler('palette.json');
  const sessionsHandlers = makeJsonFileHandler('sessions.json');

  const appendSession: RouteHandler = async (req, res) => {
    const filepath = join(REPO_ROOT, 'sessions.json');
    const newSession = await readBody(req);
    let current: any[] = [];
    if (await fileExists(filepath)) {
      const content = await fs.readFile(filepath, 'utf-8');
      current = JSON.parse(content);
    }
    current.push(newSession);
    await writeFileAtomic(filepath, JSON.stringify(current, null, 2) + '\n');
    sendJson(res, 200, current);
  };

  const getLinkIndex: RouteHandler = async (_req, res) => {
    const entries: LinkIndexEntry[] = [];
    for (const dir of SCAN_DIRS) {
      const dirPath = join(REPO_ROOT, dir);
      if (!(await fileExists(dirPath))) continue;
      const files = await fs.readdir(dirPath);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        if (f === 'README.md') continue;
        const full = join(dirPath, f);
        const stat = await fs.stat(full);
        if (!stat.isFile()) continue;
        entries.push({
          path: `${dir}/${f}`,
          title: await extractTitle(full),
          type: typeByDir[dir] ?? 'other',
        });
      }
    }
    const partyPath = join(REPO_ROOT, 'party.md');
    if (await fileExists(partyPath)) {
      entries.push({
        path: 'party.md',
        title: await extractTitle(partyPath),
        type: 'other',
      });
    }
    sendJson(res, 200, entries);
  };

  const IMAGE_MIME: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };

  const getFile: RouteHandler = async (_req, res, params) => {
    const relPath = decodeURIComponent(params.path);
    const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
    const isMarkdown = ext === 'md';
    const imageMime = IMAGE_MIME[ext];
    if (!isMarkdown && !imageMime) return sendError(res, 404, 'Unsupported file type');
    const absolute = safeResolveInRepo(relPath);
    if (!absolute) return sendError(res, 403, 'Path escapes repo root');
    if (!(await fileExists(absolute))) return sendError(res, 404, 'File not found');
    const stat = await fs.stat(absolute);
    res.statusCode = 200;
    res.setHeader('Content-Type', isMarkdown ? 'text/markdown; charset=utf-8' : imageMime!);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.end(await fs.readFile(absolute, isMarkdown ? 'utf-8' : undefined));
  };

  const listTrash: RouteHandler = async (_req, res) => {
    await ensureTrashDir();
    const files = await fs.readdir(TRASH_DIR);
    const entries = [];
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const full = join(TRASH_DIR, f);
      const stat = await fs.stat(full);
      entries.push({
        filename: f,
        trashedAt: stat.mtime.toUTCString(),
        size: stat.size,
      });
    }
    sendJson(res, 200, entries);
  };

  const restoreTrash: RouteHandler = async (_req, res, params) => {
    const filename = decodeURIComponent(params.filename);
    const trashPath = join(TRASH_DIR, filename);
    if (!(await fileExists(trashPath))) return sendError(res, 404, 'Trash entry not found');
    const origMatch = filename.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z?-(.+)$/);
    const original = origMatch ? origMatch[1] : filename;
    const restorePath = join(EVENTS_DIR, original);
    if (await fileExists(restorePath)) {
      return sendError(res, 409, `An event already exists at ${original}`);
    }
    await fs.rename(trashPath, restorePath);
    sendJson(res, 200, { restored: original });
  };

  const deleteTrashEntry: RouteHandler = async (_req, res, params) => {
    const filename = decodeURIComponent(params.filename);
    const trashPath = join(TRASH_DIR, filename);
    if (!(await fileExists(trashPath))) return sendError(res, 404, 'Trash entry not found');
    await fs.unlink(trashPath);
    sendJson(res, 200, { ok: true });
  };

  const emptyTrash: RouteHandler = async (_req, res) => {
    await ensureTrashDir();
    const files = await fs.readdir(TRASH_DIR);
    for (const f of files) {
      if (f.endsWith('.md')) await fs.unlink(join(TRASH_DIR, f));
    }
    sendJson(res, 200, { ok: true });
  };

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
    defineRoute('GET',    '/api/events',                    listEvents),
    defineRoute('POST',   '/api/events',                    createEvent),
    defineRoute('GET',    '/api/events/:filename',          getEvent),
    defineRoute('PUT',    '/api/events/:filename',          updateEvent),
    defineRoute('DELETE', '/api/events/:filename',          deleteEvent),
    defineRoute('GET',    '/api/state',                     stateHandlers.get),
    defineRoute('PUT',    '/api/state',                     stateHandlers.put),
    defineRoute('GET',    '/api/tags',                      tagsHandlers.get),
    defineRoute('PUT',    '/api/tags',                      tagsHandlers.put),
    defineRoute('GET',    '/api/palette',                   paletteHandlers.get),
    defineRoute('PUT',    '/api/palette',                   paletteHandlers.put),
    defineRoute('GET',    '/api/sessions',                  sessionsHandlers.get),
    defineRoute('POST',   '/api/sessions',                  appendSession),
    defineRoute('GET',    '/api/link-index',                getLinkIndex),
    defineRoute('GET',    '/api/file/:path*',               getFile),
    defineRoute('GET',    '/api/trash',                     listTrash),
    defineRoute('POST',   '/api/trash/:filename/restore',   restoreTrash),
    defineRoute('DELETE', '/api/trash/:filename',           deleteTrashEntry),
    defineRoute('DELETE', '/api/trash',                     emptyTrash),
    defineRoute('GET',    '/api/git/status',                gitStatus),
    defineRoute('POST',   '/api/git/commit',                gitCommit),
  ];

  return async function handler(req, res, next) {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/api/')) {
      if (next) return next();
      return sendError(res, 404, 'Not found');
    }

    for (const r of ROUTES) {
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
