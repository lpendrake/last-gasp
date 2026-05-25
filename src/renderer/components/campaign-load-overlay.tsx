import { CampaignLoadingScreen } from '../views/campaigns/campaign-loading-screen';
import { LoadingNotification } from './loading-notification';

interface CampaignLoadOverlayProps {
  result: 'idle' | 'loading' | 'success' | 'error';
  progress: { percentage: number; taskName: string };
  errorMessage: string | null;
  onDismissNotification: () => void;
}

export function CampaignLoadOverlay({
  result,
  progress,
  errorMessage,
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

  if (result === 'error') {
    return (
      <LoadingNotification
        message={errorMessage ?? 'Failed to load campaign'}
        variant="error"
        onDismiss={onDismissNotification}
        sticky
      />
    );
  }

  return null;
}
