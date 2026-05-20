import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const lastGaspTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--theme-text-primary)',
      backgroundColor: 'var(--theme-background)',
    },
    '.cm-content': {
      caretColor: 'var(--theme-accent-gold)',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--theme-accent-gold)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(201, 168, 96, 0.2)',
    },

    '.cm-panels': { backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text-primary)' },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--theme-border)' },
    '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--theme-border)' },

    '.cm-searchMatch': {
      backgroundColor: 'rgba(201, 168, 96, 0.3)',
      outline: '1px solid var(--theme-accent-gold)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(201, 168, 96, 0.5)',
    },

    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
    '.cm-selectionMatch': { backgroundColor: 'rgba(201, 168, 96, 0.1)' },

    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(201, 168, 96, 0.2)',
      outline: '1px solid var(--theme-accent-gold)',
    },

    '.cm-gutters': {
      backgroundColor: 'var(--theme-background)',
      color: 'var(--theme-text-muted)',
      border: 'none',
    },

    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      color: 'var(--theme-text-secondary)',
    },

    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#ddd',
    },

    '.cm-tooltip': {
      border: '1px solid var(--theme-border)',
      backgroundColor: 'var(--theme-surface)',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'var(--theme-border)',
      borderBottomColor: 'var(--theme-border)',
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: 'var(--theme-surface)',
      borderBottomColor: 'var(--theme-surface)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--theme-panel)',
        color: 'var(--theme-text-primary)',
      },
    },
  },
  { dark: true },
);

export const lastGaspHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--theme-accent-warm)' },
  {
    tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
    color: 'var(--theme-text-primary)',
  },
  { tag: [t.function(t.variableName), t.labelName], color: 'var(--theme-accent-gold)' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: 'var(--theme-accent-warm)' },
  { tag: [t.definition(t.name), t.separator], color: 'var(--theme-text-primary)' },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: 'var(--theme-accent-gold)',
  },
  {
    tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
    color: 'var(--theme-link)',
  },
  { tag: [t.meta, t.comment], color: 'var(--theme-text-muted)', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: 'var(--theme-link)', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: 'var(--theme-accent-gold)' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: 'var(--theme-accent-warm)' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: 'var(--theme-text-secondary)' },
  { tag: t.invalid, color: '#ff0000' },
]);

export const lastGaspThemeExtensions: Extension = [
  lastGaspTheme,
  syntaxHighlighting(lastGaspHighlightStyle),
];
