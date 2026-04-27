/** Shared types for frontend and backend. */

export interface EventFrontmatter {
  title: string;
  date: string;           // ISO-style Golarian date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
  tags?: string[];
  color?: string;         // hex override for card header strip
  status?: 'happened' | 'planned';
}

export interface Event extends EventFrontmatter {
  filename: string;       // e.g. "4726-05-04-chess-puzzle.md"
  body: string;           // raw markdown body (excluding frontmatter)
  mtime: string;          // ISO UTC timestamp from the filesystem
}

export interface EventListItem extends EventFrontmatter {
  filename: string;
  mtime: string;
  // Body omitted in list responses for payload size
}

export interface State {
  in_game_now: string;            // ISO-style Golarian date
  current_session: string | null; // real-world date string or null
  campaign_start: string;
}

export interface TagInfo {
  color: string;
  description: string;
}

export type TagsRegistry = Record<string, TagInfo>;

export interface Session {
  real_date: string;       // real-world ISO date
  in_game_start: string;   // Golarian ISO
  notes: string;
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

export interface LinkIndexEntry {
  path: string;            // relative path from repo root
  title: string;
  type: 'event' | 'npc' | 'faction' | 'location' | 'plot' | 'session' | 'rule' | 'player-facing' | 'misc' | 'other';
}
