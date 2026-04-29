import type { NoteEntry } from '../data/types.ts';

export type { NoteEntry };

export interface OpenTab {
  folder: string;
  /** Path within the folder, e.g. "stormhaven/the-spire.md" */
  path: string;
  fileKind?: 'note' | 'asset';
}

export const ASSET_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export interface FileState {
  content: string | null; // null while loading
  mtime: string;
  dirty: boolean;
  loading: boolean;
}

export interface Toast {
  id: string;
  message: string;
}

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export type TreeFile = {
  kind: 'file';
  name: string;
  path: string; // relative to top-level folder
  title: string;
  fileKind: 'note' | 'asset';
};

export type TreeDir = {
  kind: 'dir';
  name: string;
  path: string; // relative to top-level folder
  children: TreeNode[];
};

export type TreeNode = TreeFile | TreeDir;

export function buildTree(entries: NoteEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      const dirPath = parts.slice(0, i + 1).join('/');
      let dir = current.find(
        (n): n is TreeDir => n.kind === 'dir' && n.name === dirName,
      );
      if (!dir) {
        dir = { kind: 'dir', name: dirName, path: dirPath, children: [] };
        current.push(dir);
      }
      current = dir.children;
    }
    current.push({ kind: 'file', name: parts[parts.length - 1], path: entry.path, title: entry.title, fileKind: entry.kind ?? 'note' });
  }
  return root;
}

/** Derive a display color from a folder name (falls back to misc). */
export const KNOWN_FOLDER_COLORS: Record<string, string> = {
  npcs:            'var(--kind-npc)',
  locations:       'var(--kind-location)',
  factions:        'var(--kind-faction)',
  plots:           'var(--kind-plot)',
  rules:           'var(--kind-rule)',
  sessions:        'var(--kind-session)',
  'player-facing': 'var(--kind-player-facing)',
  misc:            'var(--kind-misc)',
};

export function folderColor(name: string): string {
  return KNOWN_FOLDER_COLORS[name] ?? 'var(--kind-misc)';
}

export function tabKey(tab: OpenTab): string {
  return `${tab.folder}/${tab.path}`;
}

export function titleFromContent(content: string | null, fallback: string): string {
  if (!content) return fallback;
  const m = /^#\s+(.+)$/m.exec(content);
  return m ? m[1].trim() : fallback;
}

export function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s\-_/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
