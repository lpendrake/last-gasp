import React from 'react';
import { NotesApp } from '../../notes/Notes';

export function NotesView({ campaignPath, campaignId }: { campaignPath: string, campaignId: string }) {
  return <NotesApp campaignPath={campaignPath} campaignId={campaignId} />;
}
