import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fsApi', {
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:write', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath),
  onFileChange: (callback: (data: { event: string; path: string }) => void) => {
    const listener = (_event: unknown, data: { event: string; path: string }) => callback(data);
    ipcRenderer.on('fs:changed', listener);
    return () => ipcRenderer.removeListener('fs:changed', listener);
  },
  // Campaign Management
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getRootDir: () => ipcRenderer.invoke('settings:getRootDir'),
  setRootDir: (path: string) => ipcRenderer.invoke('settings:setRootDir', path),
  scanCampaigns: (rootDir: string) => ipcRenderer.invoke('campaign:scan', rootDir),
  createCampaign: (rootDir: string, name: string, description: string) =>
    ipcRenderer.invoke('campaign:create', rootDir, name, description),
  openCampaign: (path: string) => ipcRenderer.invoke('campaign:open', path),
  closeCampaign: () => ipcRenderer.invoke('campaign:close'),
});
