import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { writeFileAtomic } from './atomic.ts';
import {
  NOTES_EXCLUDED, ASSET_EXTS, SCAN_DIRS, safeResolveInRepo, safeNoteResolve,
} from './paths.ts';
import { extractTitleFromContent } from '../../domain/yaml.ts';
import type { NoteStore, NoteFile, NoteFileStat } from '../ports.ts';
import type { NoteEntry, LinkIndexEntry } from '../../../src/data/types.ts';

async function extractTitleFromFile(filepath: string): Promise<string> {
  const content = await fs.readFile(filepath, 'utf-8');
  return extractTitleFromContent(content, basename(filepath, '.md'));
}

const TYPE_BY_DIR: Record<string, LinkIndexEntry['type']> = {
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

const NOTES_TRASH_DIR = '.notes-trash';

async function scanMdFiles(dir: string, relBase: string): Promise<NoteEntry[]> {
  const out: NoteEntry[] = [];
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
        out.push({ path: rel, title: await extractTitleFromFile(full), mtime: stat.mtime.toUTCString(), kind: 'note' });
      } else if (e.isFile() && ASSET_EXTS.has(e.name.split('.').pop()?.toLowerCase() ?? '')) {
        const stat = await fs.stat(full);
        out.push({ path: rel, title: e.name, mtime: stat.mtime.toUTCString(), kind: 'asset' });
      }
    }
  } catch { /* dir not accessible */ }
  return out;
}

/** Filesystem-backed NoteStore. The single adapter for everything
 * notes-related: folder CRUD, file CRUD, asset upload, link index,
 * peek file reads, and the cross-folder helpers used by the link
 * rewriter in domain/links.ts. */
export function makeFsNoteStore(repoRoot: string): NoteStore {
  const NOTES_TRASH = join(repoRoot, NOTES_TRASH_DIR);

  async function safeStat(absolute: string): Promise<NoteFileStat | null> {
    try {
      const stat = await fs.stat(absolute);
      return { mtime: stat.mtime, isFile: stat.isFile(), isDirectory: stat.isDirectory() };
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async function pathExists(p: string): Promise<boolean> {
    try { await fs.access(p); return true; } catch { return false; }
  }

  return {
    async listFolders() {
      const out: { name: string }[] = [];
      try {
        const entries = await fs.readdir(repoRoot, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          if (e.name.startsWith('.')) continue;
          if (NOTES_EXCLUDED.has(e.name)) continue;
          out.push({ name: e.name });
        }
      } catch { return []; }
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    },

    async isFolder(folder) {
      const abs = safeResolveInRepo(repoRoot, folder);
      if (!abs) return false;
      const stat = await safeStat(abs);
      return !!stat && stat.isDirectory;
    },

    async createFolder(folder) {
      const abs = safeResolveInRepo(repoRoot, folder)!;
      await fs.mkdir(abs, { recursive: true });
    },

    async renameFolder(oldName, newName) {
      const src = safeResolveInRepo(repoRoot, oldName)!;
      const dest = safeResolveInRepo(repoRoot, newName)!;
      await fs.rename(src, dest);
    },

    async softDeleteFolder(folder, trashName) {
      const src = safeResolveInRepo(repoRoot, folder)!;
      await fs.mkdir(NOTES_TRASH, { recursive: true });
      await fs.rename(src, join(NOTES_TRASH, trashName));
    },

    async scanFolder(folder) {
      const abs = safeResolveInRepo(repoRoot, folder);
      if (!abs || !(await pathExists(abs))) return [];
      return scanMdFiles(abs, '');
    },

    async fileExists(folder, notePath) {
      const abs = safeNoteResolve(repoRoot, folder, notePath);
      if (!abs) return false;
      return pathExists(abs);
    },

    async readFile(folder, notePath): Promise<NoteFile | null> {
      const abs = safeNoteResolve(repoRoot, folder, notePath);
      if (!abs) return null;
      const stat = await safeStat(abs);
      if (!stat || !stat.isFile) return null;
      const content = await fs.readFile(abs);
      return { content, mtime: stat.mtime };
    },

    async statFile(folder, notePath) {
      const abs = safeNoteResolve(repoRoot, folder, notePath);
      if (!abs) return null;
      return safeStat(abs);
    },

    async writeFile(folder, notePath, content) {
      const abs = safeNoteResolve(repoRoot, folder, notePath)!;
      await fs.mkdir(dirname(abs), { recursive: true });
      await writeFileAtomic(abs, content);
      const stat = await fs.stat(abs);
      return { mtime: stat.mtime };
    },

    async rename(oldFolder, oldPath, newFolder, newPath) {
      const src = safeNoteResolve(repoRoot, oldFolder, oldPath)!;
      const dest = safeNoteResolve(repoRoot, newFolder, newPath)!;
      await fs.mkdir(dirname(dest), { recursive: true });
      await fs.rename(src, dest);
    },

    async softDeleteFile(folder, notePath, trashName) {
      const src = safeNoteResolve(repoRoot, folder, notePath)!;
      await fs.mkdir(NOTES_TRASH, { recursive: true });
      await fs.rename(src, join(NOTES_TRASH, trashName));
    },

    async writeAsset(folder, filename, data) {
      const assetsDir = join(repoRoot, folder, 'assets');
      await fs.mkdir(assetsDir, { recursive: true });
      await fs.writeFile(join(assetsDir, filename), data);
    },

    async readRepoFile(relPath) {
      const abs = safeResolveInRepo(repoRoot, relPath);
      if (!abs) return null;
      const stat = await safeStat(abs);
      if (!stat || !stat.isFile) return null;
      const content = await fs.readFile(abs);
      return { content, mtime: stat.mtime };
    },

    async scanLinkIndex() {
      const out: LinkIndexEntry[] = [];
      for (const dir of SCAN_DIRS) {
        const dirPath = join(repoRoot, dir);
        if (!(await pathExists(dirPath))) continue;
        const entries = await scanMdFiles(dirPath, dir);
        for (const e of entries) {
          if (e.kind !== 'note') continue;
          out.push({
            path: e.path,
            title: e.title,
            type: TYPE_BY_DIR[dir] ?? 'other',
          });
        }
      }
      const partyPath = join(repoRoot, 'party.md');
      if (await pathExists(partyPath)) {
        out.push({ path: 'party.md', title: await extractTitleFromFile(partyPath), type: 'other' });
      }
      return out;
    },

    async listAllNoteMarkdown() {
      const folders = await this.listFolders();
      const out: string[] = [];
      for (const { name } of folders) {
        const entries = await scanMdFiles(join(repoRoot, name), name);
        for (const e of entries) if (e.kind === 'note') out.push(e.path);
      }
      return out;
    },

    async readMarkdown(relPath) {
      const abs = safeResolveInRepo(repoRoot, relPath);
      if (!abs) return null;
      try { return await fs.readFile(abs, 'utf-8'); }
      catch (err: any) { if (err.code === 'ENOENT') return null; throw err; }
    },

    async writeMarkdown(relPath, content) {
      const abs = safeResolveInRepo(repoRoot, relPath)!;
      await writeFileAtomic(abs, content);
    },
  };
}
