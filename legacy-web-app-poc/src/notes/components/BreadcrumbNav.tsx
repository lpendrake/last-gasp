import React from 'react';
import { tabKey, type OpenTab } from '../types.ts';
import type { SaveStatus } from '../hooks/useSaveSync.ts';

interface BreadcrumbNavProps {
  activeTab: OpenTab;
  savingState: Record<string, SaveStatus>;
  savedAt: Record<string, string>;
}

const STATUS_TEXT: Record<SaveStatus, (savedAt?: string) => string> = {
  clean: (at) => at ? `saved ${at}` : 'saved',
  dirty: () => 'unsaved',
  saving: () => 'saving…',
  saved: (at) => at ? `saved ${at}` : 'saved ✓',
};

/** Path breadcrumbs above the editor with a save-status indicator
 * pinned to the right. */
export function BreadcrumbNav({ activeTab, savingState, savedAt }: BreadcrumbNavProps) {
  const key = tabKey(activeTab);
  const status: SaveStatus = savingState[key] ?? 'clean';
  const at = savedAt[key];
  const pathParts = activeTab.path.split('/');
  return (
    <div className="breadcrumbs">
      <span className="breadcrumb-segment">vault</span>
      <span className="breadcrumb-sep">/</span>
      <span className="breadcrumb-segment">{activeTab.folder}</span>
      {pathParts.slice(0, -1).map((part, i) => (
        <React.Fragment key={i}>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-segment">{part}</span>
        </React.Fragment>
      ))}
      <span className="breadcrumb-sep">/</span>
      <span className="breadcrumb-segment is-leaf">{pathParts[pathParts.length - 1]}</span>
      <span className={`breadcrumb-status is-${status}`}>{STATUS_TEXT[status](at)}</span>
    </div>
  );
}
