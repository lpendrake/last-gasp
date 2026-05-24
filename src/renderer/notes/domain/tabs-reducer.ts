import type { OpenTab } from '../types';

export type TabsState = {
  tabs: OpenTab[];
  activeTab: OpenTab | null;
};

export type TabsAction =
  | { type: 'open'; folder: string; path: string; fileKind?: OpenTab['fileKind'] }
  | { type: 'close'; folder: string; path: string }
  | { type: 'close-folder'; folder: string }
  | { type: 'rename-file'; folder: string; oldPath: string; newPath: string }
  | { type: 'rename-folder'; oldFolder: string; newFolder: string };

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'open': {
      const { folder, path, fileKind } = action;
      const tab: OpenTab = { folder, path, fileKind };
      const tabs = state.tabs.some((t) => t.folder === folder && t.path === path)
        ? state.tabs
        : [...state.tabs, tab];
      return { tabs, activeTab: tab };
    }
    case 'close': {
      const { folder, path } = action;
      if (!state.tabs.some((t) => t.folder === folder && t.path === path)) return state;
      const tabs = state.tabs.filter((t) => !(t.folder === folder && t.path === path));
      const activeTab =
        state.activeTab?.folder === folder && state.activeTab.path === path
          ? (tabs[tabs.length - 1] ?? null)
          : state.activeTab;
      return { tabs, activeTab };
    }
    case 'close-folder': {
      const { folder } = action;
      const tabs = state.tabs.filter((t) => t.folder !== folder);
      const activeTab =
        state.activeTab?.folder === folder ? (tabs[tabs.length - 1] ?? null) : state.activeTab;
      return { tabs, activeTab };
    }
    case 'rename-file': {
      const { folder, oldPath, newPath } = action;
      const tabs = state.tabs.map((t) =>
        t.folder === folder && t.path === oldPath ? { ...t, path: newPath } : t,
      );
      const activeTab =
        state.activeTab?.folder === folder && state.activeTab.path === oldPath
          ? { ...state.activeTab, path: newPath }
          : state.activeTab;
      return { tabs, activeTab };
    }
    case 'rename-folder': {
      const { oldFolder, newFolder } = action;
      const tabs = state.tabs.map((t) =>
        t.folder === oldFolder ? { ...t, folder: newFolder } : t,
      );
      const activeTab =
        state.activeTab?.folder === oldFolder
          ? { ...state.activeTab, folder: newFolder }
          : state.activeTab;
      return { tabs, activeTab };
    }
    default:
      return state;
  }
}
