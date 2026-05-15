import { NotesApp } from '../../notes/notes';

export function NotesView({
  campaignPath,
  campaignId,
}: {
  campaignPath: string;
  campaignId: string;
}) {
  return <NotesApp campaignPath={campaignPath} campaignId={campaignId} />;
}
