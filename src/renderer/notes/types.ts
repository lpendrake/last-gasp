export interface NoteEntry {
  id: string;
  path: string;
  title: string;
  /** 'dir' = empty directory with no indexed children */
  kind?: 'note' | 'asset' | 'unsupported' | 'dir';
}

export interface OpenTab {
  folder: string;
  /** Path within the folder, e.g. "npcs/bob.md" */
  path: string;
  fileKind?: 'note' | 'asset' | 'unsupported';
}

export {
  ASSET_EXTENSIONS,
  classifyByExt,
  isEditableNote,
  isFileKind,
} from '../../shared/fileKinds';

export interface FileState {
  content: string | null; // null while loading; body only (no frontmatter)
  frontmatter: string; // raw YAML without --- delimiters; '' when none
  dirty: boolean;
  loading: boolean;
}

export interface Toast {
  id: string;
  message: string;
  isError?: boolean;
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
  id: string;
  fileKind: 'note' | 'asset' | 'unsupported';
};

export type TreeDir = {
  kind: 'dir';
  name: string;
  path: string; // relative to top-level folder
  children: TreeNode[];
};

export type TreeNode = TreeFile | TreeDir;

function ensureDir(nodes: TreeNode[], parts: string[], depth: number): TreeNode[] {
  const dirName = parts[depth];
  const dirPath = parts.slice(0, depth + 1).join('/');
  let dir = nodes.find((n): n is TreeDir => n.kind === 'dir' && n.name === dirName);
  if (!dir) {
    dir = { kind: 'dir', name: dirName, path: dirPath, children: [] };
    nodes.push(dir);
  }
  return dir.children;
}

export function buildTree(entries: NoteEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const entry of entries) {
    const parts = entry.path.split('/');

    if (entry.kind === 'dir') {
      // Materialise the directory even though it has no file children.
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        current = ensureDir(current, parts, i);
      }
      continue;
    }

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      current = ensureDir(current, parts, i);
    }
    const fileKind = entry.kind === 'asset' || entry.kind === 'unsupported' ? entry.kind : 'note';
    current.push({
      kind: 'file',
      name: parts[parts.length - 1],
      path: entry.path,
      title: entry.title,
      id: entry.id,
      fileKind,
    });
  }
  return root;
}

/** Derive a display color from a folder name (falls back to misc). */
export const KNOWN_FOLDER_COLORS: Record<string, string> = {
  'player characters': 'var(--kind-pc)',
  factions: 'var(--kind-faction)',
  locations: 'var(--kind-location)',
  npcs: 'var(--kind-npc)',
  plots: 'var(--kind-plot)',
  misc: 'var(--kind-misc)',
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

export { slugify } from './domain/slugify';
