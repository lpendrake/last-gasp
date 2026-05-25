import { CampaignLoadingScreen } from '../views/campaigns/campaign-loading-screen';
import { LoadingNotification } from './loading-notification';

interface CampaignLoadOverlayProps {
  result: 'idle' | 'loading' | 'success' | 'error';
  progress: { percentage: number; taskName: string };
  onDismissNotification: () => void;
}

export function CampaignLoadOverlay({
  result,
  progress,
  onDismissNotification,
}: CampaignLoadOverlayProps) {
  if (result === 'loading') {
    return <CampaignLoadingScreen percentage={progress.percentage} taskName={progress.taskName} />;
  }

  if (result === 'success') {
    return (
      <LoadingNotification
        message="Campaign loaded"
        variant="success"
        onDismiss={onDismissNotification}
        autoDismissMs={5000}
      />
    );
  }

  return null;
}
