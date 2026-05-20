// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../show', () => ({ showPeek: vi.fn() }));
vi.mock('../resolve', () => ({ resolvePeekTarget: vi.fn() }));

import { showPeek } from '../show';
import { resolvePeekTarget } from '../resolve';
import { initPeek, teardownPeek, openFromWikiLink, closeFromWikiLink } from '../stack';
import type { ShowPeekOptions, PeekHandle } from '../show';

const mockShowPeek = vi.mocked(showPeek);
const mockResolvePeekTarget = vi.mocked(resolvePeekTarget);

interface FakeHandle {
  pin: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readonly el: HTMLDivElement;
  _el: HTMLDivElement;
  path: string;
  capturedOnPin?: () => void;
  capturedOnClose?: () => void;
}

function makeFakeHandle(path: string): FakeHandle {
  const el = document.createElement('div') as HTMLDivElement;
  el.className = 'peek-window';
  document.body.appendChild(el);
  return {
    pin: vi.fn(),
    close: vi.fn(),
    get el() {
      return el;
    },
    _el: el,
    path,
  };
}

function makeLinkEl(noteId = 'abc123') {
  const span = document.createElement('span');
  span.className = 'cm-note-link';
  span.dataset.noteId = noteId;
  document.body.appendChild(span);
  return span;
}

function hover(target: Element, relatedTarget: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent('mouseover', { bubbles: true, cancelable: true, relatedTarget }),
  );
}

function unhover(target: Element, relatedTarget: Element | null = null) {
  target.dispatchEvent(
    new MouseEvent('mouseout', { bubbles: true, cancelable: true, relatedTarget }),
  );
}

function pressKey(key: string) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const stopSpy = vi.spyOn(e, 'stopImmediatePropagation');
  window.dispatchEvent(e);
  return stopSpy;
}

// Configures showPeek to return a fresh fake handle and captures onPin/onClose
let capturedCalls: Array<{ opts: ShowPeekOptions; handle: FakeHandle }> = [];

function setupMock(path = 'notes/foo.md') {
  const handle = makeFakeHandle(path);
  mockShowPeek.mockImplementationOnce((opts) => {
    handle.capturedOnPin = opts.onPin;
    handle.capturedOnClose = opts.onClose;
    capturedCalls.push({ opts, handle });
    return handle as unknown as PeekHandle;
  });
  return handle;
}

beforeEach(() => {
  vi.resetAllMocks(); // clears call history AND queued implementations/returnValues
  capturedCalls = [];
  vi.useFakeTimers();
  mockResolvePeekTarget.mockReturnValue({ path: 'notes/foo.md' });
  initPeek({ fetcher: vi.fn(), getLinkIndex: () => [] });
});

afterEach(() => {
  teardownPeek();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('open delay', () => {
  it('does not open before 150ms', () => {
    setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(149);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });

  it('opens after 150ms', () => {
    setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);
    expect(mockShowPeek).toHaveBeenCalledTimes(1);
    expect(capturedCalls[0].opts).toMatchObject({
      linkInfo: { path: 'notes/foo.md' },
      stackDepth: 0,
    });
  });

  it('does not open when link does not resolve', () => {
    mockResolvePeekTarget.mockReturnValueOnce(null);
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(200);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });

  it('does not open for non-link elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    hover(div);
    vi.advanceTimersByTime(200);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });
});

describe('depth calculation', () => {
  it('opens at depth 0 when link is in page flow', () => {
    setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);
    expect(capturedCalls[0].opts.stackDepth).toBe(0);
  });

  it('opens at depth 1 when link is inside a depth-0 peek window', () => {
    // Build depth-0 window
    const handle0 = setupMock('notes/a.md');
    mockResolvePeekTarget.mockReturnValueOnce({ path: 'notes/a.md' });
    const link0 = makeLinkEl('id0');
    hover(link0);
    vi.advanceTimersByTime(150);

    // Nested link inside the depth-0 window
    mockResolvePeekTarget.mockReturnValueOnce({ path: 'notes/b.md' });
    setupMock('notes/b.md');
    const link1 = makeLinkEl('id1');
    handle0._el.appendChild(link1);
    hover(link1);
    vi.advanceTimersByTime(150);

    expect(capturedCalls[1].opts.stackDepth).toBe(1);
  });
});

describe('same-path idempotency', () => {
  it('does not call showPeek again for same path at same depth', () => {
    setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);
    expect(mockShowPeek).toHaveBeenCalledTimes(1);

    // Re-hover same link (same path, same depth 0)
    hover(link);
    vi.advanceTimersByTime(150);
    expect(mockShowPeek).toHaveBeenCalledTimes(1);
  });

  it('prunes deeper windows when re-hovering a shallower same-path link', () => {
    // Open depth-0 window A
    mockResolvePeekTarget.mockReturnValue({ path: 'notes/a.md' });
    const handleA = setupMock('notes/a.md');
    const linkA = makeLinkEl('idA');
    hover(linkA);
    vi.advanceTimersByTime(150);

    // Open depth-1 window B (from inside A's window)
    mockResolvePeekTarget.mockReturnValue({ path: 'notes/b.md' });
    const handleB = setupMock('notes/b.md');
    const linkB = makeLinkEl('idB');
    handleA._el.appendChild(linkB);
    hover(linkB);
    vi.advanceTimersByTime(150);
    expect(mockShowPeek).toHaveBeenCalledTimes(2);

    // Re-hover linkA at depth 0 — same path 'notes/a.md', should prune B
    mockResolvePeekTarget.mockReturnValue({ path: 'notes/a.md' });
    hover(linkA);
    vi.advanceTimersByTime(150);
    expect(handleB.close).toHaveBeenCalled();
    expect(mockShowPeek).toHaveBeenCalledTimes(2); // no new window
  });
});

describe('close delay', () => {
  it('starts 250ms close timer when mousing to a non-live element', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    unhover(link, document.body);
    vi.advanceTimersByTime(249);
    expect(handle.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handle.close).toHaveBeenCalled();
  });

  it('cancels close timer when mouse enters a peek window', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    // Start close timer
    unhover(link, document.body);

    // Before it fires, hover into the peek window
    const peekWin = handle._el;
    hover(peekWin);

    vi.advanceTimersByTime(300);
    expect(handle.close).not.toHaveBeenCalled();
  });

  it('cancels open timer on mouseout', () => {
    const link = makeLinkEl();
    hover(link);
    // mouseout before open timer fires
    unhover(link, document.body);
    vi.advanceTimersByTime(200);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });

  it('cancels close timer when re-hovering a qualifying link', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    // Start close timer
    unhover(link, document.body);

    // Hover same link again (cancel close, start open)
    setupMock();
    hover(link);
    vi.advanceTimersByTime(300);
    expect(handle.close).not.toHaveBeenCalled();
  });
});

describe('Esc key', () => {
  it('pops only the top window from the stack', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    const stopSpy = pressKey('Escape');
    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('does not call stopImmediatePropagation when stack is empty', () => {
    const stopSpy = pressKey('Escape');
    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('does not respond to non-Escape keys', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    pressKey('Enter');
    expect(handle.close).not.toHaveBeenCalled();
  });

  it('pops only top when multiple windows are open', () => {
    // Depth 0
    mockResolvePeekTarget.mockReturnValue({ path: 'notes/a.md' });
    const handle0 = setupMock('notes/a.md');
    const link0 = makeLinkEl('id0');
    hover(link0);
    vi.advanceTimersByTime(150);

    // Depth 1
    mockResolvePeekTarget.mockReturnValue({ path: 'notes/b.md' });
    const handle1 = setupMock('notes/b.md');
    const link1 = makeLinkEl('id1');
    handle0._el.appendChild(link1);
    hover(link1);
    vi.advanceTimersByTime(150);

    pressKey('Escape');
    expect(handle1.close).toHaveBeenCalledTimes(1);
    expect(handle0.close).not.toHaveBeenCalled();
  });
});

describe('pin behavior', () => {
  it('moves handle from stack to pinned on onPin callback', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    // Trigger pin — window leaves stack
    handle.capturedOnPin!();

    // Escape should not close pinned handle (stack is now empty)
    pressKey('Escape');
    expect(handle.close).not.toHaveBeenCalled();
  });

  it('closes pinned windows on teardownPeek', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);
    handle.capturedOnPin!();

    teardownPeek();
    expect(handle.close).toHaveBeenCalled();
  });
});

describe('openFromWikiLink', () => {
  it('opens a window after 150ms delay', () => {
    const handle = setupMock();
    const el = makeLinkEl();
    openFromWikiLink('abc123', el);
    vi.advanceTimersByTime(149);
    expect(mockShowPeek).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mockShowPeek).toHaveBeenCalledTimes(1);
    expect(capturedCalls[0].handle).toBe(handle);
  });

  it('does nothing when id does not resolve', () => {
    mockResolvePeekTarget.mockReturnValueOnce(null);
    openFromWikiLink('unknown', makeLinkEl());
    vi.advanceTimersByTime(200);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });

  it('cancels an existing close timer', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    // Start close timer
    unhover(link, document.body);

    // openFromWikiLink should cancel close
    setupMock();
    openFromWikiLink('abc123', makeLinkEl('id2'));
    vi.advanceTimersByTime(300);
    expect(handle.close).not.toHaveBeenCalled();
  });

  it('does nothing before initPeek is called', () => {
    teardownPeek(); // config = null
    openFromWikiLink('abc123', makeLinkEl());
    vi.advanceTimersByTime(200);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });
});

describe('closeFromWikiLink', () => {
  it('starts close timer when relatedTarget is not live', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    closeFromWikiLink(document.body as unknown as Element);
    vi.advanceTimersByTime(250);
    expect(handle.close).toHaveBeenCalled();
  });

  it('does not start timer when relatedTarget is inside a peek window', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    const innerEl = document.createElement('span');
    handle._el.appendChild(innerEl);

    closeFromWikiLink(innerEl);
    vi.advanceTimersByTime(300);
    expect(handle.close).not.toHaveBeenCalled();
  });

  it('does not start timer when relatedTarget is null', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    closeFromWikiLink(null);
    vi.advanceTimersByTime(300);
    // null relatedTarget IS considered non-live, so close timer starts
    expect(handle.close).toHaveBeenCalled();
  });

  it('does nothing before initPeek is called', () => {
    teardownPeek(); // config = null
    // should not throw
    closeFromWikiLink(null);
    vi.advanceTimersByTime(300);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });
});

describe('teardownPeek', () => {
  it('closes all open windows on teardown', () => {
    const handle = setupMock();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(150);

    teardownPeek();
    expect(handle.close).toHaveBeenCalled();
  });

  it('stops responding to events after teardown', () => {
    teardownPeek();
    const link = makeLinkEl();
    hover(link);
    vi.advanceTimersByTime(200);
    expect(mockShowPeek).not.toHaveBeenCalled();
  });

  it('is safe to call twice', () => {
    teardownPeek();
    expect(() => teardownPeek()).not.toThrow();
  });
});

describe('MAX_DEPTH cap', () => {
  it('clamps stackDepth at MAX_DEPTH - 1 (4)', () => {
    // Build up 5 nested windows by nesting each inside the previous
    let prevHandle: FakeHandle | null = null;
    for (let i = 0; i < 5; i++) {
      const path = `notes/note${i}.md`;
      mockResolvePeekTarget.mockReturnValueOnce({ path });
      const handle = setupMock(path);
      const link = makeLinkEl(`id${i}`);
      if (prevHandle) {
        prevHandle._el.appendChild(link);
      }
      hover(link);
      vi.advanceTimersByTime(150);
      prevHandle = handle;
    }

    // The 5th window (depth 4) should have stackDepth clamped at 4 (MAX_DEPTH - 1)
    expect(capturedCalls.length).toBe(5);
    expect(capturedCalls[4].opts.stackDepth).toBe(4);
    // Verify the 6th call would also be clamped (depth 5 → clamped to 4)
    const path5 = 'notes/note5.md';
    mockResolvePeekTarget.mockReturnValueOnce({ path: path5 });
    const handle5 = setupMock(path5);
    const link5 = makeLinkEl('id5');
    prevHandle!._el.appendChild(link5);
    hover(link5);
    vi.advanceTimersByTime(150);
    expect(capturedCalls[5].opts.stackDepth).toBe(4);
    // suppress unused var warning
    void handle5;
  });
});
