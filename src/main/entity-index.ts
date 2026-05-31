import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseNote, stringifyNote } from '../shared/frontmatter.js';
import { ASSET_EXTENSIONS } from '../shared/fileKinds.js';
import type { EntityIndexEntry } from '../shared/entity-index-entry.js';
export type { EntityIndexEntry } from '../shared/entity-index-entry.js';

export { ASSET_EXTENSIONS };

export function findEntityById(id: string, campaignPath: string): string | null {
  for (const subdir of ['notes', 'timeline']) {
    const result = findMdById(id, path.join(campaignPath, subdir));
    if (result) return result;
  }
  return null;
}

function findMdById(id: string, dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = findMdById(id, fullPath);
      if (result) return result;
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fallbackTitle = path.basename(fullPath, '.md');
        const { frontmatter } = parseNote(content, fallbackTitle);
        if (frontmatter.id === id) return fullPath;
      } catch {
        // skip unreadable files
      }
    }
  }
  return null;
}

export function buildEntityIndex(
  campaignPath: string,
  onProgress?: (completed: number, total: number) => void,
): EntityIndexEntry[] {
  const index: EntityIndexEntry[] = [];
  const notesDir = path.join(campaignPath, 'notes');
  const timelineDir = path.join(campaignPath, 'timeline');

  const total = countFiles(notesDir, true) + countFiles(timelineDir, false);
  let completed = 0;
  const tick = onProgress
    ? () => {
        onProgress(++completed, total);
      }
    : undefined;

  if (fs.existsSync(notesDir)) {
    scanDir(notesDir, 'note', notesDir, index, tick);
  }
  if (fs.existsSync(timelineDir)) {
    scanDir(timelineDir, 'event', timelineDir, index, tick);
  }

  return index;
}

/**
 * Index a single .md file and return its entry.
 * Writes back frontmatter if id/title were auto-generated.
 * Returns null if the file is not a tracked markdown file.
 */
export function indexSingleEntity(fullPath: string, campaignPath: string): EntityIndexEntry | null {
  const ext = path.extname(fullPath).toLowerCase();
  const rel = path.relative(campaignPath, fullPath).replace(/\\/g, '/');
  const isNote = rel.startsWith('notes/');
  const isEvent = rel.startsWith('timeline/');
  if (!isNote && !isEvent) return null;

  if (ext === '.md') {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const fallbackTitle = path.basename(fullPath, '.md');
      const { frontmatter, body, needsWrite } = parseNote(content, fallbackTitle);
      if (needsWrite) {
        fs.writeFileSync(fullPath, stringifyNote(body, frontmatter), 'utf-8');
      }
      const type: 'note' | 'event' = isNote ? 'note' : 'event';
      const entry: EntityIndexEntry = {
        id: frontmatter.id,
        path: rel,
        title: frontmatter.title,
        type,
      };
      if (typeof frontmatter.tagLabelOverride === 'string')
        entry.tagLabelOverride = frontmatter.tagLabelOverride;
      if (typeof frontmatter.linkLabelOverride === 'string')
        entry.linkLabelOverride = frontmatter.linkLabelOverride;
      if (Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0)
        entry.tags = (frontmatter.tags as unknown[]).filter(
          (t): t is string => typeof t === 'string',
        );
      return entry;
    } catch {
      return null;
    }
  }

  if (isNote && ASSET_EXTENSIONS.has(ext)) {
    const title = path.basename(fullPath, ext);
    return { id: '', path: rel, title, type: 'asset' };
  }

  return null;
}

function isIndexable(ext: string, includeAssets: boolean): boolean {
  return ext === '.md' || (includeAssets && ASSET_EXTENSIONS.has(ext));
}

function countFiles(dir: string, includeAssets: boolean): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name), includeAssets);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (isIndexable(ext, includeAssets)) count++;
    }
  }
  return count;
}

function scanDir(
  currentDir: string,
  type: 'note' | 'event',
  baseDir: string,
  index: EntityIndexEntry[],
  tick?: () => void,
) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, type, baseDir, index, tick);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const prefix = type === 'note' ? 'notes/' : 'timeline/';

      if (ext === '.md') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fallbackTitle = path.basename(entry.name, '.md');
        const { frontmatter, body, needsWrite } = parseNote(content, fallbackTitle);
        if (needsWrite) {
          fs.writeFileSync(fullPath, stringifyNote(body, frontmatter), 'utf-8');
        }
        const indexEntry: EntityIndexEntry = {
          id: frontmatter.id,
          path: prefix + relPath,
          title: frontmatter.title,
          type,
        };
        if (typeof frontmatter.tagLabelOverride === 'string')
          indexEntry.tagLabelOverride = frontmatter.tagLabelOverride;
        if (typeof frontmatter.linkLabelOverride === 'string')
          indexEntry.linkLabelOverride = frontmatter.linkLabelOverride;
        if (Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0)
          indexEntry.tags = (frontmatter.tags as unknown[]).filter(
            (t): t is string => typeof t === 'string',
          );
        index.push(indexEntry);
        tick?.();
      } else if (type === 'note' && ASSET_EXTENSIONS.has(ext)) {
        const title = path.basename(entry.name, ext);
        index.push({ id: '', path: prefix + relPath, title, type: 'asset' });
        tick?.();
      }
    }
  }
}
