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
import {
  serialiseEvent, parseEventFile, eventFromParsed, eventListItemFromParsed, extractTitle,
} from './domain/yaml.ts';
import { sendJson, sendError } from './http/responses.ts';
import { readBody, readTextBody, readBinaryBody } from './http/body.ts';
import { defineRoute, dispatch, type RouteHandler, type Route } from './http/router.ts';
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
  const EVENTS_DIR = join(REPO_ROOT, 'events');
  const TRASH_DIR = join(EVENTS_DIR, '.trash');

  async function ensureTrashDir() {
    await fs.mkdir(TRASH_DIR, { recursive: true });
  }

  const safeResolveInRepo = (relPath: string) => safeResolveInRepoUtil(REPO_ROOT, relPath);

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
