import { NotesApp } from '../../notes/notes';

export function NotesView({
  campaignPath,
  campaignId,
  pendingOpenNotePath,
  onNoteOpenHandled,
  pendingNoteMatchOffset,
  onNoteMatchOffsetHandled,
  onOpenEvent,
}: {
  campaignPath: string;
  campaignId: string;
  pendingOpenNotePath?: string | null;
  onNoteOpenHandled?: () => void;
  pendingNoteMatchOffset?: number | null;
  onNoteMatchOffsetHandled?: () => void;
  onOpenEvent?: (filename: string) => void;
}) {
  return (
    <NotesApp
      campaignPath={campaignPath}
      campaignId={campaignId}
      pendingOpenNotePath={pendingOpenNotePath}
      onNoteOpenHandled={onNoteOpenHandled}
      pendingNoteMatchOffset={pendingNoteMatchOffset}
      onNoteMatchOffsetHandled={onNoteMatchOffsetHandled}
      onOpenEvent={onOpenEvent}
    />
  );
}
