import { ThemeProvider } from '../../theme';
import './campaign-loading-screen.css';

interface CampaignLoadingScreenProps {
  percentage: number;
  taskName: string;
}

export function CampaignLoadingScreen({ percentage, taskName }: CampaignLoadingScreenProps) {
  const bs = ThemeProvider.get().bootstrap;
  const clampedPct = Math.min(100, Math.max(0, percentage));

  return (
    <div className="campaign-loading-overlay">
      <div
        className="campaign-loading-panel"
        style={{ backgroundColor: bs.cardBg, border: `1px solid ${bs.cardBorder}` }}
      >
        <h2 className="campaign-loading-title" style={{ color: bs.primary }}>
          Loading Your Universe
        </h2>
        <div
          className="campaign-loading-bar-track"
          style={{ backgroundColor: bs.bg, border: `1px solid ${bs.cardBorder}` }}
          role="progressbar"
          aria-valuenow={clampedPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="campaign-loading-bar-fill"
            style={{ width: `${clampedPct}%`, backgroundColor: bs.primary }}
          />
        </div>
        <div className="campaign-loading-task" style={{ color: bs.textMuted }}>
          {taskName}
        </div>
      </div>
    </div>
  );
}
