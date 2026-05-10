export {};

export interface Campaign {
  name: string;
  description: string;
  folderName: string;
  path: string;
}

declare global {
  interface Window {
    fsApi: {
      readDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>;
      readFile: (filePath: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      onFileChange: (callback: (data: { event: string; path: string }) => void) => () => void;
      // Campaign Management
      selectDirectory: () => Promise<string | null>;
      getRootDir: () => Promise<string | null>;
      setRootDir: (path: string) => Promise<void>;
      scanCampaigns: (rootDir: string) => Promise<Campaign[]>;
      createCampaign: (
        rootDir: string,
        name: string,
        description: string,
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
      openCampaign: (path: string) => Promise<boolean>;
    };
  }
}
