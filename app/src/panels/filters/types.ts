// ---- Types ----

export type DateField = 'in-game' | 'session' | 'creation';

export interface TagFilter {
  id: string;
  type: 'tag';
  enabled: boolean;
  pinned: boolean;
  tags: string[]; // OR'd together
}

export interface DateFilter {
  id: string;
  type: 'date';
  enabled: boolean;
  pinned: boolean;
  field: DateField;
  from: string | null; // YYYY-MM-DD
  to: string | null;   // YYYY-MM-DD (inclusive whole day)
}

export type Filter = TagFilter | DateFilter;

export interface FilterState {
  filters: Filter[];
}
