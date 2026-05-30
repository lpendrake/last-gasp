// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// ---- Mock heavy deps before imports ----

const confirmMock = vi.fn();
vi.mock('../../../shared/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => ({ confirm: confirmMock, alert: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../../../theme', () => ({
  ThemeProvider: {
    get: vi.fn().mockReturnValue({
      timeline: {
        sessions: ['#aa0000', '#00aa00', '#0000aa'],
      },
    }),
  },
}));

// ---- Imports after mocks ----

import { SessionEditorModal } from '../session-editor-modal';
import type { Session } from '../../data/types';
import type { SessionEditorMode } from '../session-domain';

// ---- Fixtures ----

const EXISTING_SESSION: Session = {
  id: 'ses-abc1',
  inGameStart: '4726-05-04T13:00',
  inGameEnd: '4726-05-04T18:00',
  realStart: '2024-01-15T18:00',
  realEnd: '2024-01-15T22:00',
  color: '#aa0000',
};

const EDIT_MODE: SessionEditorMode = { kind: 'edit', sessionId: EXISTING_SESSION.id };

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

interface RenderEditOptions {
  onClose?: () => void;
  onSave?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

function renderEdit(options: RenderEditOptions = {}) {
  const onClose = options.onClose ?? vi.fn();
  const onSave = options.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onDelete = options.onDelete ?? vi.fn().mockResolvedValue(undefined);

  act(() => {
    root.render(
      <SessionEditorModal
        mode={EDIT_MODE}
        sessions={[EXISTING_SESSION]}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />,
    );
  });

  return { onClose, onSave, onDelete };
}

/** Flush pending async microtasks through React. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ---- Tests ----

describe('SessionEditorModal', () => {
  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue(true);
    setup();
  });

  afterEach(() => {
    teardown();
  });

  it('clicking delete with confirmation calls onDelete', async () => {
    confirmMock.mockResolvedValue(true);
    const { onDelete } = renderEdit();

    const deleteBtn = findButton('Delete');
    expect(deleteBtn).not.toBeUndefined();

    await act(async () => {
      deleteBtn!.click();
    });
    await flush();

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete session',
        danger: true,
      }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(EXISTING_SESSION.id);
  });

  it('clicking delete and cancelling does not call onDelete', async () => {
    confirmMock.mockResolvedValue(false);
    const { onDelete } = renderEdit();

    const deleteBtn = findButton('Delete');
    expect(deleteBtn).not.toBeUndefined();

    await act(async () => {
      deleteBtn!.click();
    });
    await flush();

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
