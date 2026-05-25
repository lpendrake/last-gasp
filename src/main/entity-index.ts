import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseNote, stringifyNote } from '../shared/frontmatter.js';
import { ASSET_EXTENSIONS } from '../shared/fileKinds.js';

export { ASSET_EXTENSIONS };

export interface EntityIndexEntry {
  id: string;
  path: string; // Campaign-relative path (using forward slashes)
  title: string;
  type: 'note' | 'event' | 'asset';
  tagLabelOverride?: string;
  linkLabelOverride?: string;
}

export function buildEntityIndex(campaignPath: string): EntityIndexEntry[] {
  const index: EntityIndexEntry[] = [];
  const notesDir = path.join(campaignPath, 'notes');
  const timelineDir = path.join(campaignPath, 'timeline');

  if (fs.existsSync(notesDir)) {
    scanDir(notesDir, 'note', notesDir, index);
  }
  if (fs.existsSync(timelineDir)) {
    scanDir(timelineDir, 'event', timelineDir, index);
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

function scanDir(
  currentDir: string,
  type: 'note' | 'event',
  baseDir: string,
  index: EntityIndexEntry[],
) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, type, baseDir, index);
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
        index.push(indexEntry);
      } else if (type === 'note' && ASSET_EXTENSIONS.has(ext)) {
        const title = path.basename(entry.name, ext);
        index.push({ id: '', path: prefix + relPath, title, type: 'asset' });
      }
    }
  }
}
