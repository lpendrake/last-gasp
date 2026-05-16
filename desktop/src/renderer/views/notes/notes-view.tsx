import { NotesApp } from '../../notes/notes';

export function NotesView({
  campaignPath,
  campaignId,
  pendingOpenNotePath,
  onNoteOpenHandled,
}: {
  campaignPath: string;
  campaignId: string;
  pendingOpenNotePath?: string | null;
  onNoteOpenHandled?: () => void;
}) {
  return (
    <NotesApp
      campaignPath={campaignPath}
      campaignId={campaignId}
      pendingOpenNotePath={pendingOpenNotePath}
      onNoteOpenHandled={onNoteOpenHandled}
    />
  );
}
