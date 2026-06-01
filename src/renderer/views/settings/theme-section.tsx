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
  const { defaultThemeId, rows, coreThemes, setDefaultTheme, changeRowTheme } = useThemeMenu(
    rootDir,
    campaigns,
    activeCampaign,
  );

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

      {rows.length > 0 && (
        <>
          <h4 className="theme-section__subsection-title">Per-Campaign Overrides</h4>
          {rows.map((row) => (
            <ThemeOverrideRow
              key={row.campaignPath}
              campaignName={row.campaignName}
              selectedThemeId={row.themeId}
              coreThemes={coreThemes}
              onChangeTheme={(id) => changeRowTheme(row.campaignPath, id)}
            />
          ))}
        </>
      )}

      <h4 className="theme-section__subsection-title">Custom Themes</h4>
      <p className="theme-section__coming-soon">Coming soon</p>
    </>
  );
}
