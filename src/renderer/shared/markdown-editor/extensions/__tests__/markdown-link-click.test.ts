import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { urlAtPos } from '../markdown-link-click';

function makeState(doc: string) {
  return EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
}

describe('urlAtPos', () => {
  it('returns URL for an external link when pos is inside the label', () => {
    // [Anthropic](https://anthropic.com) — label starts at pos 1
    const state = makeState('[Anthropic](https://anthropic.com)');
    const url = urlAtPos(state, 3); // inside "Anthropic"
    expect(url).toBe('https://anthropic.com');
  });

  it('returns URL for an internal relative link', () => {
    const state = makeState('[Faction](factions/cult.md)');
    const url = urlAtPos(state, 3); // inside "Faction"
    expect(url).toBe('factions/cult.md');
  });

  it('returns null for plain text (no link)', () => {
    const state = makeState('just some text here');
    expect(urlAtPos(state, 5)).toBeNull();
  });

  it('returns null for the inner Link node of a wiki-link [[label|id]]', () => {
    // The wiki-link [[Bob|abc1]] produces an inner Link node whose preceding char is '['
    const state = makeState('[[Bob|abc1]]');
    // pos 2 is inside the inner link label "Bob"
    expect(urlAtPos(state, 2)).toBeNull();
  });

  it('handles a mailto link', () => {
    const state = makeState('[Email](mailto:foo@example.com)');
    const url = urlAtPos(state, 3);
    expect(url).toBe('mailto:foo@example.com');
  });

  it('returns null when pos is outside any link', () => {
    const state = makeState('before [link](https://x.com) after');
    // pos 0 is before the link
    expect(urlAtPos(state, 0)).toBeNull();
    // pos 30 is after the link
    expect(urlAtPos(state, 30)).toBeNull();
  });
});
