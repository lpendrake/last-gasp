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

  // Timeline
  timelineListEvents: (campaignPath: string) =>
    ipcRenderer.invoke('timeline:listEvents', campaignPath),
  timelineGetEvent: (campaignPath: string, filename: string) =>
    ipcRenderer.invoke('timeline:getEvent', campaignPath, filename),
  timelineCreateEvent: (
    campaignPath: string,
    filename: string,
    frontmatter: unknown,
    body: string,
  ) => ipcRenderer.invoke('timeline:createEvent', campaignPath, filename, frontmatter, body),
  timelineUpdateEvent: (
    campaignPath: string,
    filename: string,
    frontmatter: unknown,
    body: string,
    ifUnmodifiedSince: string,
  ) =>
    ipcRenderer.invoke(
      'timeline:updateEvent',
      campaignPath,
      filename,
      frontmatter,
      body,
      ifUnmodifiedSince,
    ),
  timelineDeleteEvent: (campaignPath: string, filename: string, ifUnmodifiedSince: string) =>
    ipcRenderer.invoke('timeline:deleteEvent', campaignPath, filename, ifUnmodifiedSince),
  timelineGetSessions: (campaignPath: string) =>
    ipcRenderer.invoke('timeline:getSessions', campaignPath),
  timelinePutSessions: (campaignPath: string, sessions: unknown) =>
    ipcRenderer.invoke('timeline:putSessions', campaignPath, sessions),
  timelineGetState: (campaignPath: string) =>
    ipcRenderer.invoke('timeline:getState', campaignPath),
  timelinePutState: (campaignPath: string, state: unknown) =>
    ipcRenderer.invoke('timeline:putState', campaignPath, state),
  timelineGetTags: (campaignPath: string) =>
    ipcRenderer.invoke('timeline:getTags', campaignPath),
  timelineLoadPalette: (campaignPath: string) =>
    ipcRenderer.invoke('timeline:loadPalette', campaignPath),

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // App
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => {
    const listener = (_e: unknown, info: { version: string; releaseNotes: string }) => callback(info);
    ipcRenderer.on('app:updateAvailable', listener);
    return () => ipcRenderer.removeListener('app:updateAvailable', listener);
  },
  onUpdateDownloaded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:updateDownloaded', listener);
    return () => ipcRenderer.removeListener('app:updateDownloaded', listener);
  },
});
