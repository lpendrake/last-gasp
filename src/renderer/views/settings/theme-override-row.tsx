import type { CoreThemeOption } from './domain/theme-options';
import { ThemeSelect } from './theme-select';
import './theme-section.css';

interface Props {
  campaignName: string;
  selectedThemeId: string;
  coreThemes: CoreThemeOption[];
  onChangeTheme: (id: string) => void;
}

export function ThemeOverrideRow({
  campaignName,
  selectedThemeId,
  coreThemes,
  onChangeTheme,
}: Props) {
  return (
    <div className="theme-override-row">
      <span className="theme-override-row__campaign-name">{campaignName}</span>
      <ThemeSelect
        value={selectedThemeId}
        coreThemes={coreThemes}
        onChange={onChangeTheme}
        includeUseDefault
      />
    </div>
  );
}
