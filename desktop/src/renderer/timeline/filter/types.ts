export type DateField = 'in-game' | 'session' | 'creation';

export interface TagFilter {
  id: string;
  type: 'tag';
  enabled: boolean;
  pinned: boolean;
  tags: string[];
}

export interface DateFilter {
  id: string;
  type: 'date';
  enabled: boolean;
  pinned: boolean;
  field: DateField;
  from: string | null;
  to: string | null;
}

export type Filter = TagFilter | DateFilter;

export interface FilterState {
  filters: Filter[];
}
