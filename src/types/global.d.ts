export {};

import type {
  CreateEventResult,
  EventFrontmatter,
  EventListItem,
  EventWithMtime,
  Session,
  State,
  TagsRegistry,
  ConflictResult,
} from '../renderer/timeline/data/types';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  folderName: string;
  path: string;
}

export interface EntityIndexEntry {
  id: string;
  path: string;
  title: string;
  type: 'note' | 'event' | 'asset';
  tagLabelOverride?: string;
  linkLabelOverride?: string;
}

export type EntityIndexDelta =
  | { op: 'add' | 'update'; entry: EntityIndexEntry }
  | { op: 'remove'; path: string };

declare global {
  interface Window {
    fsApi: {
      getRootDir: () => Promise<string | null>;
      setRootDir: (path: string) => Promise<void>;
      scanCampaigns: (rootDir: string) => Promise<Campaign[]>;
      createCampaign: (
        rootDir: string,
        name: string,
        description: string,
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
      openCampaign: (
        path: string,
      ) => Promise<
        { success: true; entityIndex: EntityIndexEntry[] } | { success: false; error: string }
      >;
      closeCampaign: () => Promise<void>;

      // File System
      mkdir: (path: string) => Promise<boolean>;
      readDir: (path: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>;
      read: (path: string) => Promise<string | null>;
      write: (path: string, content: string) => Promise<boolean>;
      writeBuffer: (path: string, buffer: Uint8Array) => Promise<boolean>;
      delete: (path: string) => Promise<boolean>;
      trash: (path: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      rename: (oldPath: string, newPath: string) => Promise<boolean>;

      // Notes
      buildIndex: (campaignPath: string) => Promise<EntityIndexEntry[]>;
      ensureDirs: (notesDir: string) => Promise<boolean>;
      getEntityIndex: () => Promise<EntityIndexEntry[]>;
      updateEntityLabelOverride: (
        id: string,
        target: 'tagLabel' | 'linkLabel',
        value: string | null,
      ) => Promise<boolean>;

      // Watcher
      onFileChange: (callback: (data: { event: string; path: string }) => void) => () => void;
      onEntityDelta: (callback: (delta: EntityIndexDelta) => void) => () => void;

      // Dialog
      selectDirectory: () => Promise<string | null>;

      // Timeline
      timelineListEvents: (campaignPath: string) => Promise<EventListItem[]>;
      timelineGetEvent: (campaignPath: string, filename: string) => Promise<EventWithMtime>;
      timelineCreateEvent: (
        campaignPath: string,
        filename: string,
        frontmatter: EventFrontmatter,
        body: string,
      ) => Promise<CreateEventResult>;
      timelineUpdateEvent: (
        campaignPath: string,
        filename: string,
        frontmatter: EventFrontmatter,
        body: string,
        ifUnmodifiedSince: string,
      ) => Promise<EventWithMtime | ConflictResult>;
      timelineDeleteEvent: (
        campaignPath: string,
        filename: string,
        ifUnmodifiedSince: string,
      ) => Promise<{ ok: true } | ConflictResult>;
      timelineGetSessions: (campaignPath: string) => Promise<Session[]>;
      timelinePutSessions: (campaignPath: string, sessions: Session[]) => Promise<{ ok: true }>;
      timelineGetState: (campaignPath: string) => Promise<State>;
      timelinePutState: (campaignPath: string, state: State) => Promise<{ ok: true }>;
      timelineGetTags: (campaignPath: string) => Promise<TagsRegistry>;

      // App
      getAppVersion: () => Promise<string>;
      installUpdate: () => Promise<void>;
      onUpdateAvailable: (
        callback: (info: { version: string; releaseNotes: string }) => void,
      ) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;

      // Campaign Loading
      onLoadProgress: (
        callback: (data: { percentage: number; taskName: string }) => void,
      ) => () => void;
      onLoadComplete: (callback: () => void) => () => void;
      onLoadError: (callback: (data: { message: string }) => void) => () => void;
    };
  }
}
