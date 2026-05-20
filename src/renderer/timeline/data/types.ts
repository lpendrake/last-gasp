export interface EventFrontmatter {
  title: string;
  date: string;
  tags?: string[];
  color?: string;
  status?: 'happened' | 'planned';
  id?: string;
}

export interface Event extends EventFrontmatter {
  filename: string;
  body: string;
  mtime: string;
}

export interface EventListItem extends EventFrontmatter {
  filename: string;
  mtime: string;
}

export interface State {
  in_game_now: string;
  campaign_start: string;
}

export interface TagInfo {
  color: string;
  description: string;
}

export type TagsRegistry = Record<string, TagInfo>;

export interface Session {
  id: string;
  inGameStart: string;
  inGameEnd: string;
  realStart: string;
  realEnd: string;
  color: string;
  real_date?: string;
  in_game_start?: string;
  notes?: string;
}

export interface Palette {
  theme: Record<string, string>;
  weekdays: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
}

export type ConflictResult = { conflict: true };

export interface EventWithMtime {
  event: Event;
  lastModified: string;
}
