import type { Campaign } from '../../../types/global';
import type { CoreThemeOption } from './domain/theme-options';
import { ThemeSelect } from './theme-select';
import './theme-section.css';

interface Props {
  campaigns: Campaign[];
  selectedCampaignPath: string;
  selectedThemeId: string;
  coreThemes: CoreThemeOption[];
  onChangeCampaign: (path: string) => void;
  onChangeTheme: (id: string) => void;
  onRemove: () => void;
}

export function ThemeOverrideRow({
  campaigns,
  selectedCampaignPath,
  selectedThemeId,
  coreThemes,
  onChangeCampaign,
  onChangeTheme,
  onRemove,
}: Props) {
  return (
    <div className="theme-override-row">
      <button
        type="button"
        className="theme-override-row__remove"
        aria-label="Remove override"
        onClick={onRemove}
      >
        ×
      </button>
      <select
        className="settings-select theme-override-row__campaign-select"
        value={selectedCampaignPath}
        onChange={(e) => onChangeCampaign(e.target.value)}
      >
        {campaigns.map((c) => (
          <option key={c.path} value={c.path}>
            {c.name}
          </option>
        ))}
      </select>
      <ThemeSelect value={selectedThemeId} coreThemes={coreThemes} onChange={onChangeTheme} />
    </div>
  );
}
