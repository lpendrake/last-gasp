// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEventEditor } from '../useEventEditor';
import { ConflictError } from '../../data/ports';
import type { EventListItem, EventWithMtime } from '../../data/types';

// ---- Mocks ----

const confirmMock = vi.fn();
vi.mock('../../../shared/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => ({ confirm: confirmMock, alert: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../../data/ports', () => ({
  timelinePort: {
    deleteEvent: vi.fn(),
    getEvent: vi.fn(),
    readTemplate: vi.fn(),
  },
  ConflictError: class ConflictError extends Error {
    constructor() {
      super('Conflict');
      this.name = 'ConflictError';
    }
  },
}));

vi.mock('../create-event-checked', () => ({
  createEventChecked: vi.fn(),
}));

import { timelinePort } from '../../data/ports';
import { createEventChecked } from '../create-event-checked';
const mockDelete = vi.mocked(timelinePort.deleteEvent);
const mockGetEvent = vi.mocked(timelinePort.getEvent);
const mockReadTemplate = vi.mocked(timelinePort.readTemplate);
const mockCreateEventChecked = vi.mocked(createEventChecked);

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

beforeEach(() => {
  vi.clearAllMocks();
  confirmMock.mockReset().mockResolvedValue(true);
  mockReadTemplate.mockResolvedValue(null);
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
    confirmMock.mockResolvedValueOnce(false);
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

// ---- openNewEventPrompt ----

describe('openNewEventPrompt', () => {
  it('seeds the initial date and clears any prior error', async () => {
    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));

    // First open with an error state by simulating a duplicate
    const duplicateEvent: EventWithMtime = {
      event: {
        filename: '4726-05-04-battle.md',
        title: 'Big Battle',
        date: '4726-05-04',
        tags: [],
        body: '',
        mtime: MTIME,
      },
      lastModified: MTIME,
    };
    mockCreateEventChecked.mockResolvedValueOnce({ ok: false, reason: 'duplicate' });

    act(() => result.current.openNewEventPrompt('4726-05-04'));
    await act(async () => {
      await result.current.createAndOpen('Big Battle');
    });
    // Now there's an error
    expect(result.current.newEventPrompt?.error).not.toBeNull();

    // Re-open: error should be cleared and new date set
    act(() => result.current.openNewEventPrompt('4726-06-01'));
    expect(result.current.newEventPrompt).toEqual({ initialDate: '4726-06-01', error: null });
    void duplicateEvent; // suppress unused-variable warning
  });
});

// ---- createAndOpen ----

describe('createAndOpen', () => {
  it('writes the event and opens the editor in edit mode at the template cursor', async () => {
    const onChanged = vi.fn();
    const successEvent: EventWithMtime = {
      event: {
        filename: '4726-05-04-battle.md',
        title: 'Big Battle',
        date: '4726-05-04',
        tags: [],
        body: '',
        mtime: MTIME,
      },
      lastModified: MTIME,
    };
    mockCreateEventChecked.mockResolvedValue({ ok: true, event: successEvent });

    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));

    act(() => result.current.openNewEventPrompt('4726-05-04'));
    await act(async () => {
      await result.current.createAndOpen('Big Battle');
    });

    // Prompt cleared
    expect(result.current.newEventPrompt).toBeNull();
    // onEventsChanged called once
    expect(onChanged).toHaveBeenCalledOnce();
    // Editor opened in edit mode with the correct filename and a numeric cursor offset
    expect(result.current.editorMode).toMatchObject({
      kind: 'edit',
      filename: successEvent.event.filename,
    });
    expect(typeof (result.current.editorMode as { initialCursor?: number }).initialCursor).toBe(
      'number',
    );
  });

  it('on duplicate, keeps the prompt open with an error and does not open the editor', async () => {
    const onChanged = vi.fn();
    mockCreateEventChecked.mockResolvedValue({ ok: false, reason: 'duplicate' });

    const { result } = renderHook(() => useEventEditor(CAMPAIGN, onChanged));

    act(() => result.current.openNewEventPrompt('4726-05-04'));
    await act(async () => {
      await result.current.createAndOpen('Big Battle');
    });

    // Prompt stays open with non-empty error
    expect(result.current.newEventPrompt).not.toBeNull();
    expect(result.current.newEventPrompt?.error).toBeTruthy();
    // Editor not opened
    expect(result.current.editorMode).toBeNull();
    // onEventsChanged not called
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('uses the template body when readTemplate resolves a template with <title>', async () => {
    const successEvent: EventWithMtime = {
      event: {
        filename: '4726-05-04-battle.md',
        title: 'Big Battle',
        date: '4726-05-04',
        tags: [],
        body: '',
        mtime: MTIME,
      },
      lastModified: MTIME,
    };
    mockReadTemplate.mockResolvedValue('# <title>\n\nNotes go here.\n');
    mockCreateEventChecked.mockResolvedValue({ ok: true, event: successEvent });

    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));

    act(() => result.current.openNewEventPrompt());
    await act(async () => {
      await result.current.createAndOpen('Big Battle');
    });

    expect(mockReadTemplate).toHaveBeenCalledWith(CAMPAIGN, 'event');
    expect(mockCreateEventChecked).toHaveBeenCalledWith(
      CAMPAIGN,
      expect.any(String),
      expect.any(Object),
      '# Big Battle\n\nNotes go here.\n',
    );
  });

  it('falls back to # title heading when readTemplate resolves null', async () => {
    const successEvent: EventWithMtime = {
      event: {
        filename: '4726-05-04-battle.md',
        title: 'Big Battle',
        date: '4726-05-04',
        tags: [],
        body: '',
        mtime: MTIME,
      },
      lastModified: MTIME,
    };
    mockReadTemplate.mockResolvedValue(null);
    mockCreateEventChecked.mockResolvedValue({ ok: true, event: successEvent });

    const { result } = renderHook(() => useEventEditor(CAMPAIGN, vi.fn()));

    act(() => result.current.openNewEventPrompt());
    await act(async () => {
      await result.current.createAndOpen('Big Battle');
    });

    expect(mockReadTemplate).toHaveBeenCalledWith(CAMPAIGN, 'event');
    expect(mockCreateEventChecked).toHaveBeenCalledWith(
      CAMPAIGN,
      expect.any(String),
      expect.any(Object),
      '# Big Battle\n\n',
    );
  });
});
