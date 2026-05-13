import React from 'react';
import { folderColor, tabKey, type FileState, type OpenTab } from '../types.ts';

interface EditorTabsProps {
  tabs: OpenTab[];
  activeTab: OpenTab | null;
  openFiles: Record<string, FileState>;
  onSelect: (tab: OpenTab) => void;
  onClose: (tab: OpenTab) => void;
}

function titleForTab(tab: OpenTab): string {
  return tab.path.split('/').pop()?.replace(/\.md$/, '') ?? tab.path;
}

/** Tabs strip above the editor surface. Click a tab to switch;
 * middle-click or × button to close. The dirty marker is sourced
 * from `openFiles[tabKey].dirty`. */
export function EditorTabs({ tabs, activeTab, openFiles, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;
  return (
    <div className="tabs-bar">
      {tabs.map(tab => {
        const isActive = activeTab?.folder === tab.folder && activeTab.path === tab.path;
        const file = openFiles[tabKey(tab)];
        return (
          <div
            key={tabKey(tab)}
            className={`tab${isActive ? ' is-active' : ''}`}
            style={{ '--kind-color': folderColor(tab.folder) } as React.CSSProperties}
            onClick={() => onSelect(tab)}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); onClose(tab); } }}
          >
            <span className="tab-dot" />
            <span className="tab-label">{titleForTab(tab)}</span>
            {file?.dirty && <span className="tab-dirty">●</span>}
            <button className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(tab); }} title="Close">×</button>
          </div>
        );
      })}
    </div>
  );
}
