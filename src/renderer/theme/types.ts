export interface WeekdayColors {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface KindColors {
  pc: string;
  npc: string;
  location: string;
  faction: string;
  plot: string;
  rule: string;
  session: string;
  misc: string;
}

export interface ColorPreset {
  label: string;
  value: string;
}

export interface Theme {
  name: string;

  chrome: {
    background: string;
    surface: string;
    panel: string;
    panelAccent: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accentGold: string;
    accentWarm: string;
    accent: string;
    link: string;
    border: string;
    borderStrong: string;
    danger: string;
    dangerHover: string;
    dottedFuture: string;
  };

  timeline: {
    days: WeekdayColors;
    sessions: string[];
    eventColorPresets: ColorPreset[];
  };

  notes: {
    kinds: KindColors;
    savedIndicator: string;
    errorToast: string;
  };

  editor: {
    foldPlaceholder: string;
    invalid: string;
  };

  bootstrap: {
    bg: string;
    text: string;
    textMuted: string;
    textDim: string;
    cardBg: string;
    cardBorder: string;
    hoverBorder: string;
    dimLabel: string;
    primary: string;
    primaryActive: string;
    success: string;
    successLight: string;
    warning: string;
    danger: string;
    codeBackground: string;
    codeText: string;
    codeBorder: string;
  };
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
