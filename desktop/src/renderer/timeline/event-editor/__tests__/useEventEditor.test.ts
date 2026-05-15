// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEventEditor } from '../useEventEditor';
import { ConflictError } from '../../data/ports';
import type { EventListItem, EventWithMtime } from '../../data/types';

// ---- Mocks ----

vi.mock('../../data/ports', () => ({
  timelinePort: {
    deleteEvent: vi.fn(),
    getEvent: vi.fn(),
  },
  ConflictError: class ConflictError extends Error {
    constructor() {
      super('Conflict');
      this.name = 'ConflictError';
    }
  },
}));

import { timelinePort } from '../../data/ports';
const mockDelete = vi.mocked(timelinePort.deleteEvent);
const mockGetEvent = vi.mocked(timelinePort.getEvent);

const CAMPAIGN = '/fake/campaign';
const MTIME = '2026-01-01T00:00:00.000Z';
const FRESH_MTIME = '2026-01-02T00:00:00.000Z';

const ITEM: EventListItem = {
  filename: '4726-05-04-battle.md',
  title: 'Big Battle',
  date: '4726-05-04',
  mtime: MTIME,
};

const EVENT_WITH_MTIME: EventWithMtime = {
  event: {
    filename: ITEM.filename,
    title: ITEM.title,
    date: ITEM.date,
    tags: [],
    body: '',
    mtime: FRESH_MTIME,
  },
  lastModified: FRESH_MTIME,
};

const confirmMock = vi.fn(() => true);

beforeEach(() => {
  vi.clearAllMocks();
  confirmMock.mockReturnValue(true);
  vi.stubGlobal('confirm', confirmMock);
});

// ---- Initial state ----

describe('initial state', () => {
  it('starts with editorMode null and no conflict', () => {
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));
    expect(result.current.editorMode).toBeNull();
    expect(result.current.cardDeleteConflict).toBeNull();
  });
});

// ---- openCreate / openEdit / closeEditor ----

describe('editor mode transitions', () => {
  it('openCreate sets create mode', () => {
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));
    act(() => result.current.openCreate());
    expect(result.current.editorMode).toEqual({ kind: 'create' });
  });

  it('openCreate with initialDate includes it', () => {
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));
    act(() => result.current.openCreate('4726-03-01'));
    expect(result.current.editorMode).toEqual({ kind: 'create', initialDate: '4726-03-01' });
  });

  it('openEdit sets edit mode with filename', () => {
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));
    act(() => result.current.openEdit('foo.md'));
    expect(result.current.editorMode).toEqual({ kind: 'edit', filename: 'foo.md' });
  });

  it('closeEditor resets to null', () => {
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));
    act(() => result.current.openEdit('foo.md'));
    act(() => result.current.closeEditor());
    expect(result.current.editorMode).toBeNull();
  });
});

// ---- handleSaved / handleDeleted ----

describe('handleSaved', () => {
  it('closes editor and triggers refresh', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));
    act(() => result.current.openEdit('foo.md'));
    act(() => result.current.handleSaved('foo.md'));
    expect(result.current.editorMode).toBeNull();
    expect(onChanged).toHaveBeenCalledOnce();
  });
});

describe('handleDeleted', () => {
  it('closes editor and triggers refresh', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));
    act(() => result.current.openEdit('foo.md'));
    act(() => result.current.handleDeleted('foo.md'));
    expect(result.current.editorMode).toBeNull();
    expect(onChanged).toHaveBeenCalledOnce();
  });
});

// ---- requestDeleteFromCard ----

describe('requestDeleteFromCard', () => {
  it('calls deleteEvent and refreshes on success', async () => {
    const onChanged = vi.fn();
    mockDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));
    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    expect(confirmMock).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(CAMPAIGN, ITEM.filename, ITEM.mtime);
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('does nothing when user declines confirm', async () => {
    const onChanged = vi.fn();
    confirmMock.mockReturnValue(false);
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));
    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('sets cardDeleteConflict on ConflictError', async () => {
    const onChanged = vi.fn();
    mockDelete.mockRejectedValue(new ConflictError());
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));
    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    expect(result.current.cardDeleteConflict).toEqual({
      filename: ITEM.filename,
      title: ITEM.title,
    });
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('does not set conflict on non-ConflictError', async () => {
    const onChanged = vi.fn();
    mockDelete.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));
    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    expect(result.current.cardDeleteConflict).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

// ---- resolveCardDeleteConflict ----

describe('resolveCardDeleteConflict', () => {
  it('cancel clears conflict without calling deleteEvent', async () => {
    const onChanged = vi.fn();
    mockDelete.mockRejectedValue(new ConflictError());
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));

    // Trigger conflict
    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    await waitFor(() => expect(result.current.cardDeleteConflict).not.toBeNull());

    await act(async () => {
      await result.current.resolveCardDeleteConflict('cancel');
    });

    expect(result.current.cardDeleteConflict).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
    // Only the initial failing delete was called, not a second one
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('overwrite re-fetches mtime, retries delete, and refreshes', async () => {
    const onChanged = vi.fn();
    mockDelete.mockRejectedValueOnce(new ConflictError()).mockResolvedValueOnce(undefined);
    mockGetEvent.mockResolvedValue(EVENT_WITH_MTIME);
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));

    // Trigger conflict
    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    await waitFor(() => expect(result.current.cardDeleteConflict).not.toBeNull());

    await act(async () => {
      await result.current.resolveCardDeleteConflict('overwrite');
    });

    expect(mockGetEvent).toHaveBeenCalledWith(CAMPAIGN, ITEM.filename);
    expect(mockDelete).toHaveBeenNthCalledWith(2, CAMPAIGN, ITEM.filename, FRESH_MTIME);
    expect(result.current.cardDeleteConflict).toBeNull();
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('overwrite clears conflict even on failure', async () => {
    const onChanged = vi.fn();
    mockDelete.mockRejectedValue(new ConflictError());
    mockGetEvent.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));

    await act(async () => {
      await result.current.requestDeleteFromCard(ITEM);
    });
    await waitFor(() => expect(result.current.cardDeleteConflict).not.toBeNull());

    await act(async () => {
      await result.current.resolveCardDeleteConflict('overwrite');
    });

    expect(result.current.cardDeleteConflict).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
