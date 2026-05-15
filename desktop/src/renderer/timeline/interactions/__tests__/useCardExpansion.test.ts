// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCardExpansion } from '../useCardExpansion';
import type { PanController } from '../usePan';
import type { EventWithMtime } from '../../data/types';

// ---- Mocks ----

vi.mock('../../data/ports', () => ({
  timelinePort: {
    getEvent: vi.fn(),
  },
}));

import { timelinePort } from '../../data/ports';
const mockGetEvent = vi.mocked(timelinePort.getEvent);

function makePan(wasMoved = false): PanController {
  return {
    destroy: vi.fn(),
    isDragging: vi.fn(() => false),
    wasMoved: vi.fn(() => wasMoved),
  };
}

function makeEventResponse(filename: string, body: string): EventWithMtime {
  return {
    event: {
      filename,
      title: 'T',
      date: '4726-05-04',
      tags: [],
      mtime: '2026-01-01T00:00:00Z',
      body,
    },
    lastModified: '2026-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  mockGetEvent.mockReset();
});

// ---- Tests ----

describe('useCardExpansion', () => {
  it('starts with no expansion', () => {
    const pan = makePan();
    const { result } = renderHook(() => useCardExpansion('camp', pan));
    expect(result.current.expansion).toBeNull();
  });

  it('click suppressed when pan.wasMoved() is true — expansion stays null', async () => {
    const pan = makePan(true); // wasMoved = true
    const { result } = renderHook(() => useCardExpansion('camp', pan));

    act(() => {
      result.current.handleCardClick('a.md');
    });

    expect(result.current.expansion).toBeNull();
    expect(mockGetEvent).not.toHaveBeenCalled();
  });

  it('sets body to null (loading) immediately on click, then loads the body', async () => {
    const pan = makePan();
    let resolveEvent!: (v: EventWithMtime) => void;
    mockGetEvent.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveEvent = resolve;
      }),
    );

    const { result } = renderHook(() => useCardExpansion('camp', pan));

    act(() => {
      result.current.handleCardClick('a.md');
    });

    // Immediately after click: loading state
    expect(result.current.expansion).toEqual({ filename: 'a.md', body: null });

    // Resolve the fetch
    await act(async () => {
      resolveEvent(makeEventResponse('a.md', '# Hello'));
    });

    expect(result.current.expansion).toEqual({ filename: 'a.md', body: '# Hello' });
  });

  it('clicking the expanded card again collapses it', async () => {
    const pan = makePan();
    mockGetEvent.mockResolvedValueOnce(makeEventResponse('a.md', '# A'));
    const { result } = renderHook(() => useCardExpansion('camp', pan));

    await act(async () => {
      result.current.handleCardClick('a.md');
    });
    await waitFor(() => expect(result.current.expansion?.body).toBe('# A'));

    // Click same card again
    act(() => {
      result.current.handleCardClick('a.md');
    });

    expect(result.current.expansion).toBeNull();
  });

  it('clicking a different card before the first fetch resolves discards the first body', async () => {
    const pan = makePan();

    let resolveA!: (v: EventWithMtime) => void;
    mockGetEvent
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveA = r;
        }),
      ) // A hangs
      .mockResolvedValueOnce(makeEventResponse('b.md', '# B')); // B resolves

    const { result } = renderHook(() => useCardExpansion('camp', pan));

    // Click A (hangs)
    act(() => result.current.handleCardClick('a.md'));
    expect(result.current.expansion?.filename).toBe('a.md');

    // Click B before A resolves
    await act(async () => result.current.handleCardClick('b.md'));
    await waitFor(() => expect(result.current.expansion?.body).toBe('# B'));

    // Now resolve A late — should be discarded
    await act(async () => {
      resolveA(makeEventResponse('a.md', '# A'));
    });

    // B's expansion is still shown; A's body was discarded
    expect(result.current.expansion).toEqual({ filename: 'b.md', body: '# B' });
  });

  it('clicking the loading card (body: null) collapses it, and the fetch result is discarded', async () => {
    const pan = makePan();
    let resolveA!: (v: EventWithMtime) => void;
    mockGetEvent.mockReturnValueOnce(
      new Promise((r) => {
        resolveA = r;
      }),
    );

    const { result } = renderHook(() => useCardExpansion('camp', pan));

    // Click A — starts loading
    act(() => result.current.handleCardClick('a.md'));
    expect(result.current.expansion).toEqual({ filename: 'a.md', body: null });

    // Click A again while loading — should collapse
    act(() => result.current.handleCardClick('a.md'));
    expect(result.current.expansion).toBeNull();

    // Resolve the fetch — should be a no-op
    await act(async () => {
      resolveA(makeEventResponse('a.md', '# A'));
    });

    expect(result.current.expansion).toBeNull();
  });

  it('collapse() sets expansion to null', async () => {
    const pan = makePan();
    mockGetEvent.mockResolvedValueOnce(makeEventResponse('a.md', '# A'));
    const { result } = renderHook(() => useCardExpansion('camp', pan));

    await act(async () => result.current.handleCardClick('a.md'));
    await waitFor(() => expect(result.current.expansion?.body).toBe('# A'));

    act(() => result.current.collapse());
    expect(result.current.expansion).toBeNull();
  });

  it('Escape key collapses the expansion', async () => {
    const pan = makePan();
    mockGetEvent.mockResolvedValueOnce(makeEventResponse('a.md', '# A'));
    const { result } = renderHook(() => useCardExpansion('camp', pan));

    await act(async () => result.current.handleCardClick('a.md'));
    await waitFor(() => expect(result.current.expansion?.body).toBe('# A'));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(result.current.expansion).toBeNull();
  });

  it('Escape key does nothing when no card is expanded', () => {
    const pan = makePan();
    const { result } = renderHook(() => useCardExpansion('camp', pan));
    expect(result.current.expansion).toBeNull();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(result.current.expansion).toBeNull();
  });

  it('other key presses do not collapse the expansion', async () => {
    const pan = makePan();
    mockGetEvent.mockResolvedValueOnce(makeEventResponse('a.md', '# A'));
    const { result } = renderHook(() => useCardExpansion('camp', pan));

    await act(async () => result.current.handleCardClick('a.md'));
    await waitFor(() => expect(result.current.expansion?.body).toBe('# A'));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(result.current.expansion).not.toBeNull();
  });
});
