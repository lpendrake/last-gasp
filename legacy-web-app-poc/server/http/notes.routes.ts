import type { NoteStore } from '../data/ports.ts';
import { sendJson, sendError } from './responses.ts';
import { readBody, readTextBody, readBinaryBody } from './body.ts';
import { defineRoute, type Route } from './router.ts';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.ts';
import {
  listNoteFolders, createNoteFolder, renameNoteFolder, deleteNoteFolder,
  listNoteFiles, getNoteFile, createNoteFile, updateNoteFile, renameNoteFile, deleteNoteFile,
  uploadNoteAsset,
} from '../domain/notes.ts';
import { IMAGE_MIME } from '../data/fs/paths.ts';

interface Deps { notes: NoteStore }

function mapError(res: any, err: unknown): boolean {
  if (err instanceof ValidationError) { sendError(res, 400, err.message); return true; }
  if (err instanceof NotFoundError) { sendError(res, 404, err.message); return true; }
  if (err instanceof ConflictError) { sendError(res, 409, err.message); return true; }
  return false;
}

export function noteRoutes(deps: Deps): Route[] {
  return [
    // /api/file — peek across the whole repo. The handler does the
    // file-type / path-traversal checks here because each maps to a
    // distinct status (404 / 403 / 404), preserving prior behaviour.
    defineRoute('GET', '/api/file/:path*', async (_req, res, params) => {
      const relPath = decodeURIComponent(params.path);
      const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
      const isMarkdown = ext === 'md';
      const imageMime = IMAGE_MIME[ext];
      if (!isMarkdown && !imageMime) return sendError(res, 404, 'Unsupported file type');
      if (relPath.includes('..')) return sendError(res, 403, 'Path escapes repo root');
      const file = await deps.notes.readRepoFile(relPath);
      if (!file) return sendError(res, 404, 'File not found');
      res.statusCode = 200;
      res.setHeader('Content-Type', isMarkdown ? 'text/markdown; charset=utf-8' : imageMime!);
      res.setHeader('Last-Modified', file.mtime.toUTCString());
      res.end(isMarkdown ? file.content.toString('utf-8') : file.content);
    }),

    // /api/link-index
    defineRoute('GET', '/api/link-index', async (_req, res) => {
      sendJson(res, 200, await deps.notes.scanLinkIndex());
    }),

    // /api/notes  (folders)
    defineRoute('GET', '/api/notes', async (_req, res) => {
      sendJson(res, 200, await listNoteFolders(deps.notes));
    }),

    defineRoute('POST', '/api/notes/:folder', async (_req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      try {
        await createNoteFolder(deps.notes, folder);
        sendJson(res, 201, { ok: true });
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('GET', '/api/notes/:folder', async (_req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      try {
        sendJson(res, 200, await listNoteFiles(deps.notes, folder));
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    // /api/notes/:folder/assets/:filename — must be defined before
    // the wildcard :path* PUT below or it would be shadowed.
    defineRoute('PUT', '/api/notes/:folder/assets/:filename', async (req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const filename = decodeURIComponent(params.filename);
      const data = await readBinaryBody(req);
      try {
        const out = await uploadNoteAsset(deps.notes, folder, filename, data);
        sendJson(res, 201, out);
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    // /api/notes/:folder/:path*  (files)
    defineRoute('GET', '/api/notes/:folder/:path*', async (_req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const notePath = decodeURIComponent(params.path);
      try {
        const file = await getNoteFile(deps.notes, folder, notePath);
        const ext = notePath.split('.').pop()?.toLowerCase() ?? '';
        res.statusCode = 200;
        res.setHeader('Content-Type', file.isMarkdown
          ? 'text/plain; charset=utf-8'
          : (IMAGE_MIME[ext] ?? 'application/octet-stream'));
        res.setHeader('Last-Modified', file.mtime.toUTCString());
        res.end(file.isMarkdown ? file.content.toString('utf-8') : file.content);
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('POST', '/api/notes/:folder/:path*', async (req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const notePath = decodeURIComponent(params.path);
      const content = await readTextBody(req);
      try {
        const { mtime } = await createNoteFile(deps.notes, folder, notePath, content);
        res.statusCode = 201;
        res.setHeader('Last-Modified', mtime.toUTCString());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('PUT', '/api/notes/:folder/:path*', async (req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const notePath = decodeURIComponent(params.path);
      const content = await readTextBody(req);
      const ius = req.headers['if-unmodified-since'] as string | undefined;
      try {
        const { mtime } = await updateNoteFile(deps.notes, folder, notePath, content, ius);
        res.statusCode = 200;
        res.setHeader('Last-Modified', mtime.toUTCString());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('PATCH', '/api/notes/:folder', async (req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const body = await readBody(req);
      if (!body || typeof body.newName !== 'string') return sendError(res, 400, 'Missing newName');
      try {
        sendJson(res, 200, await renameNoteFolder(deps.notes, folder, body.newName));
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('PATCH', '/api/notes/:folder/:path*', async (req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const notePath = decodeURIComponent(params.path);
      const body = await readBody(req);
      if (!body || typeof body.newPath !== 'string') return sendError(res, 400, 'Missing newPath');
      const newFolder = typeof body.newFolder === 'string' ? body.newFolder : folder;
      try {
        sendJson(res, 200, await renameNoteFile(deps.notes, folder, notePath, newFolder, body.newPath));
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('DELETE', '/api/notes/:folder', async (_req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      try {
        await deleteNoteFolder(deps.notes, folder);
        sendJson(res, 200, { ok: true });
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),

    defineRoute('DELETE', '/api/notes/:folder/:path*', async (_req, res, params) => {
      const folder = decodeURIComponent(params.folder);
      const notePath = decodeURIComponent(params.path);
      try {
        await deleteNoteFile(deps.notes, folder, notePath);
        sendJson(res, 200, { ok: true });
      } catch (err) { if (!mapError(res, err)) throw err; }
    }),
  ];
}
