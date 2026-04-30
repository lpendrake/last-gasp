// NOTE FOR AGENTS: do not extend this file. New server code goes in
// app/server/{http,domain,data}/* per the layer rules in
// app/server/AGENTS.md. Run the `add-api-route` skill before adding
// or modifying endpoints.
import type { Connect, ViteDevServer, Plugin } from 'vite';
import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { writeFileAtomic } from './data/fs/atomic.ts';
import {
  ASSET_EXTS, IMAGE_MIME, SCAN_DIRS,
  safeResolveInRepo as safeResolveInRepoUtil,
  validNoteFolder as validNoteFolderUtil,
  safeNoteResolve as safeNoteResolveUtil,
} from './data/fs/paths.ts';
import { extractTitle } from './domain/yaml.ts';
import { sendJson, sendError } from './http/responses.ts';
import { readBody, readTextBody, readBinaryBody } from './http/body.ts';
import { defineRoute, dispatch, type RouteHandler, type Route } from './http/router.ts';
import { makeFsEventStore } from './data/fs/events.fs.ts';
import { makeFsStateStore } from './data/fs/state.fs.ts';
import { makeFsEventTrashStore } from './data/fs/trash.fs.ts';
import { eventRoutes } from './http/events.routes.ts';
import { stateRoutes } from './http/state.routes.ts';
import { trashRoutes } from './http/trash.routes.ts';
import type { LinkIndexEntry } from '../src/data/types.ts';

export type ApiHandler = (req: Connect.IncomingMessage, res: any, next?: (err?: any) => void) => Promise<void> | void;

export interface CreateApiOpts {
  repoRoot: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Compare mtimes at second resolution (HTTP date precision). */
function mtimeMatch(headerValue: string, stat: { mtime: Date }): boolean {
  const clientMs = new Date(headerValue).getTime();
  const serverMs = stat.mtime.getTime();
  return Math.floor(clientMs / 1000) === Math.floor(serverMs / 1000);
}

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

/** Regex matching all markdown links: `[text](href)` and `![alt](href)` */
const LINK_RE = /\]\(([^)]+)\)/g;

/**
 * After a rename/move, scans all notes in the repo and rewrites any markdown links
 * that pointed at the old path to point at the new path. Returns the number of
 * files whose content was changed.
 */
async function updateNotesLinks(
  repoRoot: string,
  oldFolder: string, oldPath: string,
  newFolder: string, newPath: string,
  isDir: boolean,
): Promise<number> {
  const oldKey = oldPath === '' ? oldFolder : `${oldFolder}/${oldPath}`;
  const newKey = newPath === '' ? newFolder : `${newFolder}/${newPath}`;

  // Collect all top-level dirs that are note folders
  let topDirs: string[] = [];
  try {
    const entries = await fs.readdir(repoRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;
      if (NOTES_EXCLUDED.has(e.name)) continue;
      topDirs.push(e.name);
    }
  } catch { return 0; }

  // Collect all .md files across all folders
  const allFiles: string[] = []; // repo-root relative paths
  for (const dir of topDirs) {
    const entries = await scanMdFiles(join(repoRoot, dir), dir);
    for (const e of entries) {
      if (e.kind === 'note') allFiles.push(e.path);
    }
  }

  let changed = 0;
  for (const repoRelPath of allFiles) {
    const absFilePath = join(repoRoot, repoRelPath);
    const srcTopFolder = repoRelPath.split('/')[0];
    let content: string;
    try { content = await fs.readFile(absFilePath, 'utf-8'); } catch { continue; }

    let modified = false;
    const newContent = content.replace(LINK_RE, (_match, href: string) => {
      // Skip absolute URLs
      if (href.startsWith('/') || href.includes('://') || href.startsWith('mailto:')) return _match;

      // Compute absolute key for this href
      let absKey: string;
      if (href.startsWith('../')) {
        absKey = href.slice(3); // strip "../"
      } else {
        absKey = `${srcTopFolder}/${href}`;
      }

      // Check if absKey matches the renamed path
      const exactMatch = absKey === oldKey;
      const prefixMatch = isDir && (absKey === oldKey || absKey.startsWith(oldKey + '/'));
      if (!exactMatch && !prefixMatch) return _match;

      // Compute new absolute key
      const newAbsKey = prefixMatch && absKey !== oldKey
        ? newKey + absKey.slice(oldKey.length)
        : newKey;

      // Compute new href relative to the scanning file's top folder
      const destTopFolder = newAbsKey.split('/')[0];
      const newHref = destTopFolder === srcTopFolder
        ? newAbsKey.split('/').slice(1).join('/')
        : `../${newAbsKey}`;

      modified = true;
      return `](${newHref})`;
    });

    if (modified) {
      await writeFileAtomic(absFilePath, newContent);
      changed++;
    }
  }
  return changed;
}

async function scanMdFiles(
  dir: string, relBase: string,
): Promise<{ path: string; title: string; mtime: string; kind: 'note' | 'asset' }[]> {
  const out: { path: string; title: string; mtime: string; kind: 'note' | 'asset' }[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...await scanMdFiles(full, rel));
      } else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md') {
        const stat = await fs.stat(full);
        out.push({ path: rel, title: await extractTitle(full), mtime: stat.mtime.toUTCString(), kind: 'note' });
      } else if (e.isFile() && ASSET_EXTS.has(e.name.split('.').pop()?.toLowerCase() ?? '')) {
        const stat = await fs.stat(full);
        out.push({ path: rel, title: e.name, mtime: stat.mtime.toUTCString(), kind: 'asset' });
      }
    }
  } catch { /* dir not accessible */ }
  return out;
}

/**
 * Build the API middleware for a given repo root.
 * Extracted so tests can point it at a temp directory.
 */
export function createApi(opts: CreateApiOpts): ApiHandler {
  const REPO_ROOT = resolve(opts.repoRoot);
  const safeResolveInRepo = (relPath: string) => safeResolveInRepoUtil(REPO_ROOT, relPath);

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
  const eventRouteList = eventRoutes({ events });
  const stateRouteList = stateRoutes({ state });
  const trashRouteList = trashRoutes({ events, trash });

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

  // ---- Notes ----
  const NOTES_TRASH = join(REPO_ROOT, '.notes-trash');

  const validNoteFolder = validNoteFolderUtil;
  const safeNoteResolve = (folder: string, notePath: string) =>
    safeNoteResolveUtil(REPO_ROOT, folder, notePath);

  const listNoteFolders: RouteHandler = async (_req, res) => {
    const folders: { name: string }[] = [];
    try {
      const dirEntries = await fs.readdir(REPO_ROOT, { withFileTypes: true });
      for (const e of dirEntries) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('.')) continue;
        if (NOTES_EXCLUDED.has(e.name)) continue;
        folders.push({ name: e.name });
      }
    } catch { return sendJson(res, 200, []); }
    folders.sort((a, b) => a.name.localeCompare(b.name));
    sendJson(res, 200, folders);
  };

  const createNoteFolder: RouteHandler = async (_req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    if (!validNoteFolder(folder)) return sendError(res, 400, 'Invalid folder name');
    const absolute = safeResolveInRepo(folder);
    if (!absolute) return sendError(res, 403, 'Path escapes repo root');
    await fs.mkdir(absolute, { recursive: true });
    sendJson(res, 201, { ok: true });
  };

  const listNoteFiles: RouteHandler = async (_req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    if (!validNoteFolder(folder)) return sendError(res, 400, 'Invalid folder');
    const folderPath = join(REPO_ROOT, folder);
    if (!(await fileExists(folderPath))) return sendJson(res, 200, []);
    sendJson(res, 200, await scanMdFiles(folderPath, ''));
  };

  const getNoteFile: RouteHandler = async (_req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    const notePath = decodeURIComponent(params.path);
    const ext = notePath.split('.').pop()?.toLowerCase() ?? '';
    const imageMime = IMAGE_MIME[ext];
    if (!notePath.endsWith('.md') && !imageMime) return sendError(res, 400, 'Unsupported file type');
    const absolute = safeNoteResolve(folder, notePath);
    if (!absolute) return sendError(res, 403, 'Path escapes repo root');
    if (!(await fileExists(absolute))) return sendError(res, 404, 'Note not found');
    const stat = await fs.stat(absolute);
    res.statusCode = 200;
    res.setHeader('Content-Type', notePath.endsWith('.md') ? 'text/plain; charset=utf-8' : imageMime!);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.end(await fs.readFile(absolute, notePath.endsWith('.md') ? 'utf-8' : undefined));
  };

  const createNoteFile: RouteHandler = async (req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    const notePath = decodeURIComponent(params.path);
    if (!notePath.endsWith('.md')) return sendError(res, 400, 'Not a markdown file');
    const absolute = safeNoteResolve(folder, notePath);
    if (!absolute) return sendError(res, 403, 'Path escapes repo root');
    if (await fileExists(absolute)) return sendError(res, 409, 'Note already exists');
    await fs.mkdir(dirname(absolute), { recursive: true });
    const content = await readTextBody(req);
    await writeFileAtomic(absolute, content);
    const stat = await fs.stat(absolute);
    res.statusCode = 201;
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  };

  const updateNoteFile: RouteHandler = async (req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    const notePath = decodeURIComponent(params.path);
    if (!notePath.endsWith('.md')) return sendError(res, 400, 'Not a markdown file');
    const absolute = safeNoteResolve(folder, notePath);
    if (!absolute) return sendError(res, 403, 'Path escapes repo root');
    if (await fileExists(absolute)) {
      const stat = await fs.stat(absolute);
      const ius = req.headers['if-unmodified-since'];
      if (ius && !mtimeMatch(ius as string, stat)) return sendError(res, 409, 'File modified since last read');
    } else {
      await fs.mkdir(dirname(absolute), { recursive: true });
    }
    const content = await readTextBody(req);
    await writeFileAtomic(absolute, content);
    const newStat = await fs.stat(absolute);
    res.statusCode = 200;
    res.setHeader('Last-Modified', newStat.mtime.toUTCString());
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  };

  const uploadNoteAsset: RouteHandler = async (req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    const filename = decodeURIComponent(params.filename);
    if (!validNoteFolder(folder)) return sendError(res, 400, 'Invalid folder name');
    if (filename.includes('/') || filename.includes('\\') || filename.startsWith('.')) return sendError(res, 400, 'Invalid filename');
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (!IMAGE_MIME[ext]) return sendError(res, 400, 'Unsupported image type');
    const assetsDir = join(REPO_ROOT, folder, 'assets');
    await fs.mkdir(assetsDir, { recursive: true });
    const absolute = join(assetsDir, filename);
    const data = await readBinaryBody(req);
    await fs.writeFile(absolute, data);
    sendJson(res, 201, { path: `assets/${filename}` });
  };

  const patchNoteFolder: RouteHandler = async (req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    if (!validNoteFolder(folder)) return sendError(res, 400, 'Invalid folder name');
    const folderAbs = safeResolveInRepo(folder);
    if (!folderAbs) return sendError(res, 403, 'Path escapes repo root');
    if (!(await fileExists(folderAbs))) return sendError(res, 404, 'Folder not found');
    const stat = await fs.stat(folderAbs);
    if (!stat.isDirectory()) return sendError(res, 400, 'Not a directory');

    const body = await readBody(req);
    if (!body || typeof body.newName !== 'string') return sendError(res, 400, 'Missing newName');
    const newName: string = body.newName;
    if (!validNoteFolder(newName)) return sendError(res, 400, 'Invalid new name');
    if (newName === folder) return sendJson(res, 200, { ok: true, updatedLinks: 0 });

    const destAbs = safeResolveInRepo(newName);
    if (!destAbs) return sendError(res, 403, 'Destination path escapes repo root');
    if (await fileExists(destAbs)) return sendError(res, 409, 'Destination already exists');

    await fs.rename(folderAbs, destAbs);
    const updatedLinks = await updateNotesLinks(REPO_ROOT, folder, '', newName, '', true);
    sendJson(res, 200, { ok: true, updatedLinks });
  };

  const patchNoteFile: RouteHandler = async (req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    const notePath = decodeURIComponent(params.path);
    if (!validNoteFolder(folder)) return sendError(res, 400, 'Invalid folder name');
    const sourceAbs = safeNoteResolve(folder, notePath);
    if (!sourceAbs) return sendError(res, 403, 'Path escapes repo root');
    if (!(await fileExists(sourceAbs))) return sendError(res, 404, 'Not found');

    const body = await readBody(req);
    if (!body || typeof body.newPath !== 'string') return sendError(res, 400, 'Missing newPath');
    const newFolder: string = (typeof body.newFolder === 'string') ? body.newFolder : folder;
    const newPath: string = body.newPath;
    if (!validNoteFolder(newFolder)) return sendError(res, 400, 'Invalid destination folder');

    const destAbs = safeNoteResolve(newFolder, newPath);
    if (!destAbs) return sendError(res, 403, 'Destination path escapes repo root');
    if (destAbs === sourceAbs) return sendJson(res, 200, { ok: true, updatedLinks: 0 });
    if (await fileExists(destAbs)) return sendError(res, 409, 'Destination already exists');

    const stat = await fs.stat(sourceAbs);
    const isDir = stat.isDirectory();
    await fs.mkdir(dirname(destAbs), { recursive: true });
    await fs.rename(sourceAbs, destAbs);

    const updatedLinks = await updateNotesLinks(REPO_ROOT, folder, notePath, newFolder, newPath, isDir);
    sendJson(res, 200, { ok: true, updatedLinks });
  };

  const deleteNoteFolder: RouteHandler = async (_req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    if (!validNoteFolder(folder)) return sendError(res, 400, 'Invalid folder name');
    const folderAbs = safeResolveInRepo(folder);
    if (!folderAbs) return sendError(res, 403, 'Path escapes repo root');
    if (!(await fileExists(folderAbs))) return sendError(res, 404, 'Folder not found');
    const stat = await fs.stat(folderAbs);
    if (!stat.isDirectory()) return sendError(res, 400, 'Not a directory');
    await fs.mkdir(NOTES_TRASH, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trashName = `${timestamp}-folder-${folder}`;
    await fs.rename(folderAbs, join(NOTES_TRASH, trashName));
    sendJson(res, 200, { ok: true });
  };

  const deleteNoteFile: RouteHandler = async (_req, res, params) => {
    const folder = decodeURIComponent(params.folder);
    const notePath = decodeURIComponent(params.path);
    const absolute = safeNoteResolve(folder, notePath);
    if (!absolute) return sendError(res, 403, 'Path escapes repo root');
    if (!(await fileExists(absolute))) return sendError(res, 404, 'Note not found');
    await fs.mkdir(NOTES_TRASH, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trashName = `${timestamp}-${folder}-${notePath.replace(/\//g, '_')}`;
    await fs.rename(absolute, join(NOTES_TRASH, trashName));
    sendJson(res, 200, { ok: true });
  };

  const ROUTES: Route[] = [
    ...eventRouteList,
    ...stateRouteList,
    defineRoute('GET',    '/api/link-index',                getLinkIndex),
    defineRoute('GET',    '/api/file/:path*',               getFile),
    ...trashRouteList,
    defineRoute('GET',    '/api/git/status',                gitStatus),
    defineRoute('POST',   '/api/git/commit',                gitCommit),
    defineRoute('GET',    '/api/notes',                     listNoteFolders),
    defineRoute('POST',   '/api/notes/:folder',             createNoteFolder),
    defineRoute('GET',    '/api/notes/:folder',             listNoteFiles),
    defineRoute('GET',    '/api/notes/:folder/:path*',      getNoteFile),
    defineRoute('POST',   '/api/notes/:folder/:path*',      createNoteFile),
    defineRoute('PUT',    '/api/notes/:folder/assets/:filename', uploadNoteAsset),
    defineRoute('PUT',    '/api/notes/:folder/:path*',      updateNoteFile),
    defineRoute('PATCH',  '/api/notes/:folder',              patchNoteFolder),
    defineRoute('PATCH',  '/api/notes/:folder/:path*',      patchNoteFile),
    defineRoute('DELETE', '/api/notes/:folder',             deleteNoteFolder),
    defineRoute('DELETE', '/api/notes/:folder/:path*',      deleteNoteFile),
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
