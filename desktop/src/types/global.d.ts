export {};

declare global {
  interface Window {
    fsApi: {
      readDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>;
      readFile: (filePath: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      onFileChange: (callback: (data: { event: string; path: string }) => void) => () => void;
    };
  }
}
