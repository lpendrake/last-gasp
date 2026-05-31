export interface EntityIndexEntry {
  id: string;
  path: string; // campaign-relative, forward slashes
  title: string;
  type: 'note' | 'event' | 'asset';
  tagLabelOverride?: string;
  linkLabelOverride?: string;
  tags?: string[];
}

export type EntityIndexDelta =
  | { op: 'add' | 'update'; entry: EntityIndexEntry }
  | { op: 'remove'; path: string };
