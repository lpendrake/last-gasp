// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { fireEvent } from '@testing-library/react';

// ---- Mock heavy deps before imports ----

const alertMock = vi.fn();
vi.mock('../../../shared/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true), alert: alertMock }),
}));

vi.mock('../../../theme', () => ({
  ThemeProvider: {
    get: vi.fn().mockReturnValue({
      bootstrap: {
        bg: '#000',
        text: '#fff',
        textDim: '#aaa',
        textMuted: '#888',
        dimLabel: '#666',
        cardBg: '#111',
        cardBorder: '#222',
        hoverBorder: '#333',
        primary: '#444',
        primaryActive: '#555',
        warning: '#fa0',
      },
    }),
  },
}));

vi.mock('../../../../assets/images/TTT.svg', () => ({ default: 'ttt.svg' }));

// ---- Imports after mocks ----

import { CampaignManager } from '../campaign-manager';

// ---- fsApi stub ----

const fsApiStub = {
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  onUpdateAvailable: vi.fn().mockReturnValue(() => {}),
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

/** Flush pending async microtasks through React. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderManager(
  overrides: {
    onCreate?: (name: string, desc: string) => Promise<{ success: boolean; error?: string }>;
  } = {},
) {
  const onOpen = vi.fn();
  const onCreate = overrides.onCreate ?? vi.fn().mockResolvedValue({ success: true });
  const onChangeDir = vi.fn();

  act(() => {
    root.render(
      <CampaignManager
        campaigns={[]}
        onOpen={onOpen}
        onCreate={onCreate}
        onChangeDir={onChangeDir}
        rootDir="/fake/root"
      />,
    );
  });

  return { onOpen, onCreate, onChangeDir };
}

/** Open the create form by clicking the "Start New Campaign" card. */
async function openCreateForm() {
  // The create card is the first child of main
  const createCard = container.querySelector<HTMLDivElement>('main > div:first-child');
  expect(createCard).not.toBeNull();
  await act(async () => {
    createCard!.click();
  });
}

/** Type a campaign name into the name input field. */
async function typeName(name: string) {
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Campaign Name"]');
  expect(input).not.toBeNull();
  await act(async () => {
    fireEvent.change(input!, { target: { value: name } });
  });
}

/** Submit the create campaign form. */
async function submitForm() {
  const form = container.querySelector('form');
  expect(form).not.toBeNull();
  await act(async () => {
    fireEvent.submit(form!);
  });
}

// ---- Tests ----

describe('CampaignManager', () => {
  beforeEach(() => {
    alertMock.mockReset().mockResolvedValue(undefined);
    vi.clearAllMocks();
    Object.defineProperty(window, 'fsApi', {
      value: fsApiStub,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    teardown();
  });

  it('shows an in-app alert when campaign creation fails', async () => {
    setup();
    const onCreate = vi.fn().mockResolvedValue({ success: false, error: 'boom' });
    renderManager({ onCreate });

    await openCreateForm();
    await typeName('My Campaign');
    await submitForm();
    await flush();

    expect(alertMock).toHaveBeenCalledTimes(1);
    const callArg = alertMock.mock.calls[0][0] as { title?: string; message: string };
    expect(callArg.message).toContain('boom');
  });

  it('does not alert when creation succeeds', async () => {
    setup();
    const onCreate = vi.fn().mockResolvedValue({ success: true });
    renderManager({ onCreate });

    await openCreateForm();
    await typeName('My Campaign');
    await submitForm();
    await flush();

    expect(alertMock).not.toHaveBeenCalled();
  });
});
