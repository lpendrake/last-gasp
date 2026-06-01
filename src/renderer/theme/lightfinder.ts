import type { Theme } from './types';

/**
 * Lightfinder — light counterpart to Dark Pathfinder.
 *
 * Aesthetic: saturated cream parchment, deep ink-brown text, real pale-sage
 * panels, deeper/saturated weekday + session palette so they still read on a
 * light field. Same color identity as Dark Pathfinder — gold, warm brick,
 * forest green, teal-blue link — rebalanced for a light background.
 */
export const lightfinder: Theme = {
  name: 'Lightfinder',

  chrome: {
    background: '#f6ead0',
    surface: '#fff5dc',
    panel: '#c4d3a6',
    panelAccent: '#a8be84',
    textPrimary: '#1c160a',
    textSecondary: '#4b4128',
    textMuted: '#7c6c48',
    accentGold: '#8a5e10',
    accentWarm: '#7e3818',
    accent: '#3a6018',
    link: '#175a82',
    border: '#d8c894',
    borderStrong: '#8c7848',
    danger: '#80281a',
    dangerHover: '#a8402a',
    dottedFuture: '#a08858',
  },

  timeline: {
    days: {
      monday: '#1e5a8e',
      tuesday: '#6a4220',
      wednesday: '#825a08',
      thursday: '#1e455a',
      friday: '#82241a',
      saturday: '#3e2a68',
      sunday: '#946a10',
    },
    sessions: ['#3a4e2a', '#4a2e4e', '#4a3618', '#1f4038', '#4e1f18'],
    eventColorPresets: [
      { label: 'Default (weekday)', value: '' },
      { label: 'Crimson', value: '#982020' },
      { label: 'Amber', value: '#a05820' },
      { label: 'Gold', value: '#8a6810' },
      { label: 'Forest', value: '#2f6228' },
      { label: 'Teal', value: '#1e5e54' },
      { label: 'Blue', value: '#1e4888' },
      { label: 'Indigo', value: '#3a2c7c' },
      { label: 'Violet', value: '#5e286c' },
      { label: 'Rose', value: '#82245a' },
      { label: 'Slate', value: '#3e465c' },
      { label: 'Custom…', value: '__custom__' },
    ],
  },

  notes: {
    kinds: {
      pc: '#6a4220',
      npc: '#1e5a8e',
      location: '#825a08',
      faction: '#82241a',
      plot: '#3e2a68',
      rule: '#3a6018',
      session: '#1e455a',
      misc: '#7c6c48',
    },
    savedIndicator: '#2f6a2a',
    errorToast: '#923222',
  },

  editor: {
    foldPlaceholder: '#5a4d33',
    invalid: '#c8281a',
    selection: '#8a5e10',
  },

  bootstrap: {
    bg: '#e8dcb4',
    text: '#15110a',
    textMuted: '#4b4128',
    textDim: '#7c6c48',
    cardBg: '#f4e8c2',
    cardBorder: '#c8b282',
    hoverBorder: '#8c7848',
    dimLabel: '#a89460',
    primary: '#8a5e10',
    primaryActive: '#6c4808',
    success: '#2f6a2a',
    successLight: '#4a8a3a',
    warning: '#a06a18',
    danger: '#80281a',
    codeBackground: '#dccfa0',
    codeText: '#1c160a',
    codeBorder: '#a8945e',
  },
};
