// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ConfirmDialogProvider, useConfirm } from '../confirm-provider';

// ---- Test consumer component ----

interface TestConsumerProps {
  onPromise: (p: Promise<boolean> | Promise<void>) => void;
  action: 'confirm' | 'alert';
  options?: {
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    okLabel?: string;
    danger?: boolean;
  };
}

function TestConsumer({ onPromise, action, options = {} }: TestConsumerProps) {
  const { confirm, alert } = useConfirm();

  const handleClick = () => {
    if (action === 'confirm') {
      const p = confirm({
        message: options.message ?? 'Are you sure?',
        title: options.title,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
        danger: options.danger,
      });
      onPromise(p);
    } else {
      const p = alert({
        message: options.message ?? 'Something happened.',
        title: options.title,
        okLabel: options.okLabel,
      });
      onPromise(p);
    }
  };

  return (
    <button type="button" data-testid="trigger" onClick={handleClick}>
      Open
    </button>
  );
}

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

interface ConsumerHandle {
  capturedPromise: Promise<boolean> | Promise<void> | null;
  triggerOpen: () => Promise<void>;
}

function renderConsumer(props: Omit<TestConsumerProps, 'onPromise'>): ConsumerHandle {
  const handle: ConsumerHandle = {
    capturedPromise: null,
    triggerOpen: async () => {
      const trigger = container.querySelector<HTMLButtonElement>('[data-testid="trigger"]');
      if (!trigger) throw new Error('trigger button not found');
      await act(async () => {
        trigger.click();
      });
    },
  };

  act(() => {
    root.render(
      <ConfirmDialogProvider>
        <TestConsumer
          action={props.action}
          options={props.options}
          onPromise={(p) => {
            handle.capturedPromise = p;
          }}
        />
      </ConfirmDialogProvider>,
    );
  });

  return handle;
}

// ---- Tests ----

describe('ConfirmDialog', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  it('confirm resolves true when the confirm button is clicked', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();
    expect(findButton('OK')).not.toBeUndefined();

    let result: boolean | undefined;
    void (handle.capturedPromise as Promise<boolean>).then((v) => {
      result = v;
    });

    await act(async () => {
      findButton('OK')!.click();
    });

    expect(result).toBe(true);
    // Dialog should be gone after resolving
    expect(findButton('OK')).toBeUndefined();
  });

  it('confirm resolves false when the cancel button is clicked', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();
    expect(findButton('Cancel')).not.toBeUndefined();

    let result: boolean | undefined;
    void (handle.capturedPromise as Promise<boolean>).then((v) => {
      result = v;
    });

    await act(async () => {
      findButton('Cancel')!.click();
    });

    expect(result).toBe(false);
    expect(findButton('Cancel')).toBeUndefined();
  });

  it('Escape resolves confirm as false', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();
    expect(findButton('OK')).not.toBeUndefined();

    let result: boolean | undefined;
    void (handle.capturedPromise as Promise<boolean>).then((v) => {
      result = v;
    });

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });

    expect(result).toBe(false);
    expect(findButton('OK')).toBeUndefined();
  });

  it('Enter resolves confirm as true', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();
    expect(findButton('OK')).not.toBeUndefined();

    let result: boolean | undefined;
    void (handle.capturedPromise as Promise<boolean>).then((v) => {
      result = v;
    });

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    });

    expect(result).toBe(true);
    expect(findButton('OK')).toBeUndefined();
  });

  it('renders multi-line message preserving line breaks', async () => {
    const { triggerOpen } = renderConsumer({
      action: 'confirm',
      options: { message: 'Line one\nLine two' },
    });

    await triggerOpen();

    const msgEl = container.querySelector('.confirm-dialog-message');
    expect(msgEl).not.toBeNull();
    // white-space: pre-wrap preserves \n; textContent will contain both parts
    expect(msgEl!.textContent).toContain('Line one');
    expect(msgEl!.textContent).toContain('Line two');
  });

  it('alert resolves void when OK is clicked and shows no Cancel button', async () => {
    const handle = renderConsumer({ action: 'alert' });

    await handle.triggerOpen();
    expect(findButton('OK')).not.toBeUndefined();
    expect(findButton('Cancel')).toBeUndefined();

    let resolved = false;
    void (handle.capturedPromise as Promise<void>).then(() => {
      resolved = true;
    });

    await act(async () => {
      findButton('OK')!.click();
    });

    expect(resolved).toBe(true);
    expect(findButton('OK')).toBeUndefined();
  });

  it('danger confirm applies destructive styling to the confirm button', async () => {
    const { triggerOpen } = renderConsumer({
      action: 'confirm',
      options: { danger: true, confirmLabel: 'Delete' },
    });

    await triggerOpen();

    const confirmBtn = findButton('Delete');
    expect(confirmBtn).not.toBeUndefined();
    expect(confirmBtn!.className).toContain('confirm-dialog-btn--danger');
  });

  it('useConfirm throws when used outside the provider', () => {
    function BadConsumer() {
      useConfirm();
      return null;
    }

    // Suppress console.error from React's error boundary output
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() => {
        act(() => {
          root.render(<BadConsumer />);
        });
      }).toThrow('useConfirm must be used within a ConfirmDialogProvider');
    } finally {
      console.error = originalError;
    }
  });

  it('a second confirm request resolves the first promise as false', async () => {
    const handle = renderConsumer({ action: 'confirm', options: { message: 'First dialog' } });

    // Open first dialog
    await handle.triggerOpen();
    const firstPromise = handle.capturedPromise as Promise<boolean>;

    let firstResult: boolean | undefined;
    void firstPromise.then((v) => {
      firstResult = v;
    });

    // Re-render with a different message and trigger a second confirm
    act(() => {
      root.render(
        <ConfirmDialogProvider>
          <TestConsumer
            action="confirm"
            options={{ message: 'Second dialog' }}
            onPromise={(p) => {
              handle.capturedPromise = p;
            }}
          />
        </ConfirmDialogProvider>,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="trigger"]');
    if (!trigger) throw new Error('trigger button not found');
    await act(async () => {
      trigger.click();
    });

    // First promise must have resolved as false (cancelled)
    expect(firstResult).toBe(false);

    // The second dialog message should now be displayed
    const msgEl = container.querySelector('.confirm-dialog-message');
    expect(msgEl?.textContent).toContain('Second dialog');
  });

  it('clicking the backdrop cancels the dialog (resolves false)', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();

    let result: boolean | undefined;
    void (handle.capturedPromise as Promise<boolean>).then((v) => {
      result = v;
    });

    const backdrop = container.querySelector<HTMLDivElement>('.confirm-dialog-backdrop');
    expect(backdrop).not.toBeNull();

    await act(async () => {
      // Dispatch mousedown where target === currentTarget (i.e. on the backdrop itself)
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: backdrop, writable: false });
      backdrop!.dispatchEvent(event);
    });

    expect(result).toBe(false);
    // Dialog should be unmounted
    expect(container.querySelector('.confirm-dialog-backdrop')).toBeNull();
  });

  it('the primary/confirm button is focused on mount', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();

    const primaryBtn = container.querySelector<HTMLButtonElement>('.confirm-dialog-btn--primary');
    expect(primaryBtn).not.toBeNull();
    expect(document.activeElement).toBe(primaryBtn);
  });

  it('a pending confirm resolves false when the provider unmounts', async () => {
    const handle = renderConsumer({ action: 'confirm' });

    await handle.triggerOpen();
    const promise = handle.capturedPromise as Promise<boolean>;

    let result: boolean | undefined;
    void promise.then((v) => {
      result = v;
    });

    // Unmount the provider/root
    await act(async () => {
      root.unmount();
    });

    // Flush microtasks so the .then callback runs
    await act(async () => {
      await Promise.resolve();
    });

    expect(result).toBe(false);
  });
});
