export interface SettingsSection {
  id: string;
  label: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'theme', label: 'Theme' },
  { id: 'templates', label: 'Templates' },
  { id: 'keybindings', label: 'Keybindings' },
];
