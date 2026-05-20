// @vitest-environment happy-dom
// Required so React's `act()` works correctly in happy-dom.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { createElement } from 'react';
import { MarkdownEditor } from '../../shared/markdown-editor/markdown-editor';

vi.mock('../show', () => ({ showPeek: vi.fn() }));

import { showPeek } from '../show';
import { initPeek, teardownPeek, openFromWikiLink, closeFromWikiLink } from '../stack';
import type { PeekHandle } from '../show';

const mockShowPeek = vi.mocked(showPeek);

let container: HTMLDivElement;
let root: Root;

function setup() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
}

function teardown() {
  act(() => root.unmount());
  container.remove();
}

describe('peek hover integration — extension callbacks', () => {
  afterEach(teardown);

  it('calls onHover with (noteId, element) when hovering a wiki-link in the editor', () => {
    setup();
    const onHover = vi.fn();
    const onHoverEnd = vi.fn();

    act(() => {
      root.render(
        createElement(MarkdownEditor, {
          // Cursor at 0, link starts at 4 → cursor is outside link → widget renders
          content: 'See [[Test Note|abc1]]',
          wikiLinks: {
            suggest: async () => [],
            onOpen: vi.fn(),
            onHover,
            onHoverEnd,
          },
        }),
      );
    });

    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link).not.toBeNull();
    expect(link!.dataset.noteId).toBe('abc1');

    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledWith('abc1', link);
  });

  it('calls onHoverEnd when mouse leaves a wiki-link', () => {
    setup();
    const onHoverEnd = vi.fn();

    act(() => {
      root.render(
        createElement(MarkdownEditor, {
          content: 'See [[Test Note|abc1]]',
          wikiLinks: {
            suggest: async () => [],
            onOpen: vi.fn(),
            onHoverEnd,
          },
        }),
      );
    });

    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link).not.toBeNull();

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    link!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: outside }));
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverEnd).toHaveBeenCalledWith(outside);
  });

  it('does not call onHover when hovering outside a wiki-link', () => {
    setup();
    const onHover = vi.fn();

    act(() => {
      root.render(
        createElement(MarkdownEditor, {
          content: 'plain text no links',
          wikiLinks: {
            suggest: async () => [],
            onOpen: vi.fn(),
            onHover,
          },
        }),
      );
    });

    container.dispatchEvent(new MouseEvent('mouseover', { bubbles: false }));
    expect(onHover).not.toHaveBeenCalled();
  });
});

describe('peek hover integration — end-to-end via initPeek', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    const fakeEl = document.createElement('div');
    fakeEl.className = 'peek-window';
    document.body.appendChild(fakeEl);
    mockShowPeek.mockReturnValue({
      pin: vi.fn(),
      close: vi.fn(),
      get el() {
        return fakeEl as HTMLDivElement;
      },
      path: 'notes/foo.md',
    } as unknown as PeekHandle);
  });

  afterEach(() => {
    teardownPeek();
    vi.useRealTimers();
    teardown();
    document.body.innerHTML = '';
  });

  it('triggers showPeek after OPEN_DELAY_MS when initPeek is wired to the editor', () => {
    initPeek({
      fetcher: vi.fn(),
      getLinkIndex: () => [{ id: 'abc1', path: 'notes/foo.md', title: 'Foo', type: 'note' }],
    });

    setup();
    act(() => {
      root.render(
        createElement(MarkdownEditor, {
          content: 'See [[Test Note|abc1]]',
          wikiLinks: {
            suggest: async () => [],
            onOpen: vi.fn(),
            // Wire onHover to the peek stack, mirroring what editor-bindings.ts does
            onHover: openFromWikiLink,
            onHoverEnd: closeFromWikiLink,
          },
        }),
      );
    });

    const link = container.querySelector<HTMLElement>('.cm-note-link');
    expect(link).not.toBeNull();

    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(mockShowPeek).not.toHaveBeenCalled(); // not yet — delay pending

    vi.advanceTimersByTime(150);
    expect(mockShowPeek).toHaveBeenCalledTimes(1);
    expect(mockShowPeek).toHaveBeenCalledWith(
      expect.objectContaining({ linkInfo: { path: 'notes/foo.md' } }),
    );
  });
});
