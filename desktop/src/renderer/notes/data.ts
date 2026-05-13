import { LinkIndexEntry } from '../../types/global';

export const notesData = {
  async readNote(path: string): Promise<string | null> {
    return window.fsApi.read(path);
  },

  async saveNote(path: string, content: string): Promise<boolean> {
    return window.fsApi.write(path, content);
  },

  async deleteNote(path: string): Promise<boolean> {
    return window.fsApi.trash(path);
  },

  async renameNote(oldPath: string, newPath: string): Promise<boolean> {
    return window.fsApi.rename(oldPath, newPath);
  },

  async getLinkIndex(campaignPath: string): Promise<LinkIndexEntry[]> {
    return window.fsApi.buildIndex(campaignPath);
  },

  async ensureNoteDirectories(notesDir: string): Promise<boolean> {
    return window.fsApi.ensureDirs(notesDir);
  },

  async listFolder(dirPath: string) {
    return window.fsApi.readDir(dirPath);
  },

  async saveImage(path: string, buffer: Uint8Array): Promise<boolean> {
    return window.fsApi.writeBuffer(path, buffer);
  },

  async mkdir(path: string): Promise<boolean> {
    return window.fsApi.mkdir(path);
  },
};
