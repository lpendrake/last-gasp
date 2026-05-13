import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fsApi', {
  // Settings & Directory Selection
  getRootDir: () => ipcRenderer.invoke('settings:getRootDir'),
  setRootDir: (path: string) => ipcRenderer.invoke('settings:setRootDir', path),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // Campaign Management
  scanCampaigns: (rootDir: string) => ipcRenderer.invoke('campaign:scan', rootDir),
  createCampaign: (rootDir: string, name: string, description: string) =>
    ipcRenderer.invoke('campaign:create', rootDir, name, description),
  openCampaign: (path: string) => ipcRenderer.invoke('campaign:open', path),
  closeCampaign: () => ipcRenderer.invoke('campaign:close'),
  
  // File System
  mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  read: (filePath: string) => ipcRenderer.invoke('fs:read', filePath),
  write: (filePath: string, content: string) => ipcRenderer.invoke('fs:write', filePath, content),
  writeBuffer: (filePath: string, buffer: Uint8Array) => ipcRenderer.invoke('fs:writeBuffer', filePath, buffer),
  delete: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath),
  trash: (filePath: string) => ipcRenderer.invoke('fs:trash', filePath),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),

  // Notes
  buildIndex: (campaignPath: string) => ipcRenderer.invoke('notes:buildIndex', campaignPath),
  ensureDirs: (notesDir: string) => ipcRenderer.invoke('notes:ensureDirs', notesDir),

  // Watcher
  onFileChange: (callback: (data: { event: string; path: string }) => void) => {
    const listener = (_event: unknown, data: { event: string; path: string }) => callback(data);
    ipcRenderer.on('fs:changed', listener);
    return () => ipcRenderer.removeListener('fs:changed', listener);
  },

  onIndexDelta: (callback: (delta: unknown) => void) => {
    const listener = (_event: unknown, delta: unknown) => callback(delta);
    ipcRenderer.on('notes:indexDelta', listener);
    return () => ipcRenderer.removeListener('notes:indexDelta', listener);
  },
});
