export {};

export interface Campaign {
  id: string;
  name: string;
  description: string;
  folderName: string;
  path: string;
}

export interface LinkIndexEntry {
  id: string;
  path: string;
  title: string;
  type: 'note' | 'event' | 'asset';
}

export type IndexDeltaEvent =
  | { op: 'add' | 'update'; entry: LinkIndexEntry }
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
      openCampaign: (path: string) => Promise<boolean>;
      closeCampaign: () => Promise<void>;

      // File System
      mkdir: (path: string) => Promise<boolean>;
      readDir: (path: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>;
      read: (path: string) => Promise<string | null>;
      write: (path: string, content: string) => Promise<boolean>;
      writeBuffer: (path: string, buffer: Uint8Array) => Promise<boolean>;
      delete: (path: string) => Promise<boolean>;
      trash: (path: string) => Promise<boolean>;
      rename: (oldPath: string, newPath: string) => Promise<boolean>;

      // Notes
      buildIndex: (campaignPath: string) => Promise<LinkIndexEntry[]>;
      ensureDirs: (notesDir: string) => Promise<boolean>;

      // Watcher
      onFileChange: (callback: (data: { event: string; path: string }) => void) => () => void;
      onIndexDelta: (callback: (delta: IndexDeltaEvent) => void) => () => void;

      // Dialog
      selectDirectory: () => Promise<string | null>;
    };
  }
}
