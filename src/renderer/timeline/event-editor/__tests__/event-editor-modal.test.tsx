// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// ---- Mock heavy deps before imports ----
// NOTE: vi.mock paths are relative to THIS test file, not the component.

vi.mock('../../data/ports', () => ({
  timelinePort: {
    getEvent: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
  ConflictError: class ConflictError extends Error {
    constructor() {
      super('Conflict');
      this.name = 'ConflictError';
    }
  },
  FilenameConflictError: class FilenameConflictError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'FilenameConflictError';
    }
  },
}));

vi.mock('../../../notes/data', () => ({
  notesData: {
    getEntityIndex: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../shared/suggest-links', () => ({
  suggestLinks: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../peek/stack', () => ({
  openFromWikiLink: vi.fn(),
  closeFromWikiLink: vi.fn(),
}));

// Render MarkdownEditor as a simple textarea so onChange is testable.
// FormatToolbar renders its footerSlot inline so buttons are discoverable.
vi.mock('../../../shared/markdown-editor', () => ({
  MarkdownEditor: ({ onChange }: { onChange: (s: string) => void; content: string }) => (
    <textarea data-testid="markdown-editor" onChange={(e) => onChange(e.target.value)} />
  ),
  FormatToolbar: ({
    footerSlot,
  }: {
    footerSlot: React.ReactNode;
    isEditable: boolean;
    viewRef: unknown;
  }) => <div data-testid="format-toolbar">{footerSlot}</div>,
}));

// FooterPortal renders inline so portal contents are in the same container.
vi.mock('../../../components/footer-portal', () => ({
  FooterPortal: ({ children }: { children: React.ReactNode; slot: string }) => (
    <div data-testid="footer-portal">{children}</div>
  ),
}));

vi.mock('../domain/initial-cursor', () => ({
  resolveInitialCursor: vi.fn().mockReturnValue(0),
}));

vi.mock('../../../../shared/entity-labels', () => ({
  buildEntityLabelMap: vi.fn().mockReturnValue(new Map()),
  buildEntityTagLabelMap: vi.fn().mockReturnValue(new Map()),
  applyEntityDelta: vi.fn((prev: unknown[]) => prev),
}));

vi.mock('../../../theme', () => ({
  ThemeProvider: {
    get: vi.fn().mockReturnValue({
      timeline: {
        eventColorPresets: [
          { label: 'Default (weekday)', value: '' },
          { label: 'Custom…', value: '__custom__' },
        ],
      },
    }),
  },
}));

// ---- Imports after mocks ----

import { timelinePort } from '../../data/ports';
import { EventEditorModal } from '../EventEditorModal';
import { fireEvent } from '@testing-library/react';

const CAMPAIGN = '/fake/campaign';
const MTIME = '2026-01-01T00:00:00.000Z';

const EDIT_MODE = { kind: 'edit' as const, filename: '4726-05-04-battle.md' };

const BASE_EVENT_DATA = {
  event: {
    filename: EDIT_MODE.filename,
    title: 'Big Battle',
    date: '4726-05-04',
    tags: [],
    body: '# Big Battle\n\nNotes here.',
    id: 'evt-abc123',
    mtime: MTIME,
  },
  lastModified: MTIME,
};

// ---- fsApi stub ----

const fsApiStub = {
  onEntityDelta: vi.fn().mockReturnValue(() => {}),
};

// ---- Test harness ----

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

function getAllButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

function findButton(text: string): HTMLButtonElement | undefined {
  return getAllButtons().find((b) => b.textContent?.trim() === text);
}

function renderCreate() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onDeleted = vi.fn();
  act(() => {
    root.render(
      <EventEditorModal
        campaignPath={CAMPAIGN}
        mode={{ kind: 'create' }}
        onClose={onClose}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />,
    );
  });
  return { onClose, onSaved, onDeleted };
}

/** Render the editor in edit mode and wait for the load to complete. */
async function renderEdit(eventData = BASE_EVENT_DATA) {
  vi.mocked(timelinePort.getEvent).mockResolvedValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventData as any,
  );
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onDeleted = vi.fn();

  // Render synchronously
  act(() => {
    root.render(
      <EventEditorModal
        campaignPath={CAMPAIGN}
        mode={EDIT_MODE}
        onClose={onClose}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />,
    );
  });

  // Flush the getEvent promise and the resulting state updates.
  // We need to drive microtasks without advancing fake timers.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return { onClose, onSaved, onDeleted };
}

/** Dirty the buffer by changing the body text via fireEvent (which properly triggers React). */
async function dirtyBuffer() {
  const editor = container.querySelector<HTMLTextAreaElement>('[data-testid="markdown-editor"]');
  if (!editor) throw new Error('markdown editor not found');
  await act(async () => {
    fireEvent.change(editor, { target: { value: '# Edited content' } });
  });
}

/** Flush pending async microtasks through React. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ---- Tests ----

describe('EventEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    Object.defineProperty(window, 'fsApi', {
      value: fsApiStub,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    teardown();
  });

  // ── Test 4: window-bar header and Title input are NOT rendered ──

  it('does not render the window-bar header or a Title input field', () => {
    setup();
    renderCreate();

    expect(container.querySelector('.event-editor-header')).toBeNull();
    expect(container.querySelector('.event-editor-title')).toBeNull();
    expect(container.querySelector('.event-editor-save-status')).toBeNull();
    expect(container.querySelector('.event-editor-close')).toBeNull();

    // No label containing "Title" visible in the form
    const labels = Array.from(container.querySelectorAll('.event-editor-field-label'));
    const titleLabel = labels.find((l) => l.textContent?.trim().toLowerCase() === 'title');
    expect(titleLabel).toBeUndefined();
  });

  // ── Test 5: footer shows Close (not Cancel) and no Save button ──

  it('shows Close button (not Cancel) and no Save button', () => {
    setup();
    renderCreate();

    const btnTexts = getAllButtons().map((b) => b.textContent?.trim());

    expect(btnTexts).toContain('Close');
    expect(btnTexts).not.toContain('Cancel');
    // Save / Saving… / ✓ Saved should all be absent
    expect(btnTexts.some((t) => t === 'Save' || t === 'Saving…' || t === '✓ Saved')).toBe(false);
  });

  // ── Effective title display and ID copy button are NOT rendered ──

  it('does not render the effective-title display or the ID copy button', async () => {
    setup();
    await renderEdit(BASE_EVENT_DATA);

    expect(container.querySelector('[aria-label="Copy event ID as wikilink"]')).toBeNull();
    expect(container.querySelector('.event-editor-effective-title')).toBeNull();
  });

  // ── Test 2a: Close with no changes just closes (no save) ──

  it('Close with no unsaved changes calls onClose immediately without saving', async () => {
    vi.useFakeTimers();
    setup();
    const { onClose, onSaved } = await renderEdit();

    const closeBtn = findButton('Close');
    expect(closeBtn).not.toBeUndefined();

    await act(async () => {
      closeBtn!.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(timelinePort.updateEvent).not.toHaveBeenCalled();
  });

  // ── Test 2b: Close with unsaved changes triggers save-then-close ──
  // No discard confirm prompt — the editor saves instead of discarding.

  it('Close with unsaved changes saves and then closes without a discard prompt', async () => {
    vi.useFakeTimers();
    setup();
    vi.mocked(timelinePort.updateEvent).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { ...BASE_EVENT_DATA.event } as any,
      lastModified: '2026-01-02T00:00:00.000Z',
    });

    const { onSaved } = await renderEdit();
    await dirtyBuffer();

    const closeBtn = findButton('Close');
    expect(closeBtn).not.toBeUndefined();

    await act(async () => {
      closeBtn!.click();
    });
    await flush();

    // No discard confirmation prompt
    expect(vi.mocked(window.confirm)).not.toHaveBeenCalledWith(expect.stringContaining('unsaved'));
    // Save was triggered and completed
    expect(timelinePort.updateEvent).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  // ── Close when buffer is INVALID discards and closes without saving ──
  // In create mode the title field starts empty; if the body also has no H1,
  // effectiveTitle is '' and validateBuffer returns an error. Clicking Close must
  // call onClose (discard) instead of attempting to save — the user must never
  // be trapped by an un-saveable edit.

  it('Close when buffer is invalid calls onClose without saving', async () => {
    vi.useFakeTimers();
    setup();

    // Create mode: title field is '' by default.
    const { onClose, onSaved } = renderCreate();

    // Dirty the buffer with body that has no H1 (effectiveTitle stays '').
    const editor = container.querySelector<HTMLTextAreaElement>('[data-testid="markdown-editor"]');
    expect(editor).not.toBeNull();
    await act(async () => {
      fireEvent.change(editor!, { target: { value: 'just some prose, no heading' } });
    });

    const closeBtn = findButton('Close');
    expect(closeBtn).not.toBeUndefined();

    await act(async () => {
      closeBtn!.click();
    });
    await flush();

    // onClose must have been called (user is not trapped)
    expect(onClose).toHaveBeenCalledTimes(1);
    // No save must have been attempted
    expect(timelinePort.createEvent).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // ── Test 1: blurring a control input flushes pending save before 500ms ──

  it('blurring the date input flushes pending autosave before 500ms timer fires', async () => {
    vi.useFakeTimers();
    setup();
    vi.mocked(timelinePort.updateEvent).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { ...BASE_EVENT_DATA.event } as any,
      lastModified: '2026-01-02T00:00:00.000Z',
    });

    await renderEdit();
    await dirtyBuffer();

    // Autosave timer is pending — 499ms hasn't elapsed
    expect(timelinePort.updateEvent).not.toHaveBeenCalled();

    // Blur the date input — should flush the save immediately
    const dateInput = container.querySelector<HTMLInputElement>(
      '[aria-label="Date (Golarian ISO)"]',
    );
    expect(dateInput).not.toBeNull();

    await act(async () => {
      fireEvent.blur(dateInput!);
    });
    await flush();

    // Save should have been called before the 500ms timer fires
    expect(timelinePort.updateEvent).toHaveBeenCalledTimes(1);
  });

  // ── Escape key: saves-then-closes (no discard confirm) ──

  it('Escape key triggers save-then-close without a discard prompt when dirty', async () => {
    vi.useFakeTimers();
    setup();
    vi.mocked(timelinePort.updateEvent).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { ...BASE_EVENT_DATA.event } as any,
      lastModified: '2026-01-02T00:00:00.000Z',
    });

    const { onSaved } = await renderEdit();
    await dirtyBuffer();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    await flush();

    expect(vi.mocked(window.confirm)).not.toHaveBeenCalledWith(expect.stringContaining('unsaved'));
    expect(timelinePort.updateEvent).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  // ── Verify autosave delay is 500ms not 2000ms ──

  it('autosave timer fires at 500ms (not 2000ms)', async () => {
    vi.useFakeTimers();
    setup();
    vi.mocked(timelinePort.updateEvent).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { ...BASE_EVENT_DATA.event } as any,
      lastModified: '2026-01-02T00:00:00.000Z',
    });

    await renderEdit();
    await dirtyBuffer();

    // At 499ms: no save yet
    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(timelinePort.updateEvent).not.toHaveBeenCalled();

    // At 500ms: autosave timer fires
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(timelinePort.updateEvent).toHaveBeenCalledTimes(1);
  });
});
