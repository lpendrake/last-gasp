import type { Campaign } from '../../../types/global';
import { SettingRow } from './controls/setting-row';
import { ThemeSelect } from './theme-select';
import { ThemeOverrideRow } from './theme-override-row';
import { useThemeMenu } from './use-theme-menu';
import './theme-section.css';

interface Props {
  campaigns: Campaign[];
  activeCampaign: Campaign;
  rootDir: string;
}

export function ThemeSection({ campaigns, activeCampaign, rootDir }: Props) {
  const {
    defaultThemeId,
    overrideRows,
    coreThemes,
    setDefaultTheme,
    addOverrideRow,
    changeRowCampaign,
    changeRowTheme,
    removeRow,
  } = useThemeMenu(rootDir, campaigns, activeCampaign);

  return (
    <>
      <SettingRow
        label="Default theme"
        description="The visual theme used by every campaign with no override, and by pre-campaign screens."
        htmlFor="theme-default-select"
      >
        <ThemeSelect
          id="theme-default-select"
          value={defaultThemeId}
          coreThemes={coreThemes}
          onChange={setDefaultTheme}
        />
      </SettingRow>

      <h4 className="theme-section__subsection-title">Per-Campaign Overrides</h4>
      <button type="button" className="theme-section__add-btn" onClick={addOverrideRow}>
        + Specify campaign theme
      </button>
      {overrideRows.map((row, index) => (
        <ThemeOverrideRow
          key={index}
          campaigns={campaigns}
          selectedCampaignPath={row.campaignPath}
          selectedThemeId={row.themeId}
          coreThemes={coreThemes}
          onChangeCampaign={(path) => changeRowCampaign(index, path)}
          onChangeTheme={(id) => changeRowTheme(index, id)}
          onRemove={() => removeRow(index)}
        />
      ))}

      <h4 className="theme-section__subsection-title">Custom Themes</h4>
      <p className="theme-section__coming-soon">Coming soon</p>
    </>
  );
}
