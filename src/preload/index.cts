import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fsApi', {
  // Settings & Directory Selection
  getRootDir: () => ipcRenderer.invoke('settings:getRootDir'),
  setRootDir: (path: string) => ipcRenderer.invoke('settings:setRootDir', path),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),

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
  buildIndex: (campaignPath: string) => ipcRenderer.invoke('entity:buildIndex', campaignPath),
  ensureDirs: (notesDir: string) => ipcRenderer.invoke('notes:ensureDirs', notesDir),
  getEntityIndex: () => ipcRenderer.invoke('entity:getAll'),
  updateEntityLabelOverride: (id: string, target: 'tagLabel' | 'linkLabel', value: string | null) =>
    ipcRenderer.invoke('entity:updateLabelOverride', id, target, value),

  // Watcher
  onFileChange: (callback: (data: { event: string; path: string }) => void) => {
    const listener = (_event: unknown, data: { event: string; path: string }) => callback(data);
    ipcRenderer.on('fs:changed', listener);
    return () => ipcRenderer.removeListener('fs:changed', listener);
  },

  onEntityDelta: (callback: (delta: unknown) => void) => {
    const listener = (_event: unknown, delta: unknown) => callback(delta);
    ipcRenderer.on('entity:indexDelta', listener);
    return () => ipcRenderer.removeListener('entity:indexDelta', listener);
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
    desiredFilename?: string,
  ) =>
    ipcRenderer.invoke(
      'timeline:updateEvent',
      campaignPath,
      filename,
      frontmatter,
      body,
      ifUnmodifiedSince,
      desiredFilename,
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

  templateRead: (campaignPath: string, name: string) =>
    ipcRenderer.invoke('template:read', campaignPath, name),

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),

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

  // Campaign Loading
  onLoadProgress: (callback: (data: { percentage: number; taskName: string }) => void) => {
    const listener = (_event: unknown, data: { percentage: number; taskName: string }) =>
      callback(data);
    ipcRenderer.on('campaign:loadProgress', listener);
    return () => ipcRenderer.removeListener('campaign:loadProgress', listener);
  },

  onLoadComplete: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('campaign:loadComplete', listener);
    return () => ipcRenderer.removeListener('campaign:loadComplete', listener);
  },

  onLoadError: (callback: (data: { message: string }) => void) => {
    const listener = (_event: unknown, data: { message: string }) => callback(data);
    ipcRenderer.on('campaign:loadError', listener);
    return () => ipcRenderer.removeListener('campaign:loadError', listener);
  },

  // Theme Settings
  getWorkspaceDefaultTheme: (rootDir: string) =>
    ipcRenderer.invoke('themeSettings:getWorkspaceDefault', rootDir),
  setWorkspaceDefaultTheme: (rootDir: string, themeId: string) =>
    ipcRenderer.invoke('themeSettings:setWorkspaceDefault', rootDir, themeId),
  getCampaignTheme: (campaignPath: string) =>
    ipcRenderer.invoke('themeSettings:getCampaign', campaignPath),
  setCampaignTheme: (campaignPath: string, themeId: string | null) =>
    ipcRenderer.invoke('themeSettings:setCampaign', campaignPath, themeId),
  getCampaignThemeOverrides: (campaignPaths: string[]) =>
    ipcRenderer.invoke('themeSettings:getCampaignOverrides', campaignPaths),
});
