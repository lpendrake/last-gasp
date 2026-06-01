import type { Theme } from './types';

export const darkPathfinder: Theme = {
  name: 'Darkfinder',

  chrome: {
    background: '#1a1a1a',
    surface: '#242420',
    panel: '#2d3d2a',
    panelAccent: '#3a4d35',
    textPrimary: '#d8d0b8',
    textSecondary: '#a89a80',
    textMuted: '#7a6f58',
    accentGold: '#c9a860',
    accentWarm: '#b87840',
    accent: '#6a9a4a',
    link: '#4fb8d0',
    border: '#3a3a30',
    borderStrong: '#5a4530',
    danger: '#c06040',
    dangerHover: '#5a2820',
    dottedFuture: '#7a6f58',
  },

  timeline: {
    days: {
      monday: '#8da8c4',
      tuesday: '#a07850',
      wednesday: '#d4a850',
      thursday: '#5a8090',
      friday: '#c06040',
      saturday: '#7560a0',
      sunday: '#e5b860',
    },
    sessions: [
      '#6b7c5a', // sage
      '#7a5c7a', // plum
      '#7a6448', // tobacco
      '#3d7068', // dusty teal
      '#7a4840', // muted brick
    ],
    eventColorPresets: [
      { label: 'Default (weekday)', value: '' },
      { label: 'Crimson', value: '#a83030' },
      { label: 'Amber', value: '#b87030' },
      { label: 'Gold', value: '#c09820' },
      { label: 'Forest', value: '#3d7a38' },
      { label: 'Teal', value: '#287868' },
      { label: 'Blue', value: '#2858a0' },
      { label: 'Indigo', value: '#483898' },
      { label: 'Violet', value: '#783888' },
      { label: 'Rose', value: '#a03068' },
      { label: 'Slate', value: '#505870' },
      { label: 'Custom…', value: '__custom__' },
    ],
  },

  notes: {
    kinds: {
      pc: '#a07850',
      npc: '#8da8c4',
      location: '#d4a850',
      faction: '#c06040',
      plot: '#7560a0',
      rule: '#6a9a4a',
      session: '#5a8090',
      misc: '#7a6f58',
    },
    savedIndicator: '#6ab06a',
    errorToast: '#c84848',
  },

  editor: {
    foldPlaceholder: '#ddd',
    invalid: '#ff0000',
    selection: '#c9a860',
  },

  bootstrap: {
    bg: '#09090b',
    text: '#ffffff',
    textMuted: '#a1a1aa',
    textDim: '#71717a',
    cardBg: '#18181b',
    cardBorder: '#27272a',
    hoverBorder: '#3f3f46',
    dimLabel: '#52525b',
    primary: '#6366f1',
    primaryActive: '#4338ca',
    success: '#10b981',
    successLight: '#34d399',
    warning: '#f59e0b',
    danger: '#ef4444',
    codeBackground: '#000',
    codeText: '#d4d4d8',
    codeBorder: '#27272a',
  },
};
