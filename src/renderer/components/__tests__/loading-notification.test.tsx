// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { LoadingNotification } from '../loading-notification';

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

describe('LoadingNotification', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('renders the message', () => {
    act(() =>
      root.render(
        <LoadingNotification message="Campaign loaded" variant="success" onDismiss={() => {}} />,
      ),
    );
    expect(container.textContent).toContain('Campaign loaded');
  });

  it('has a dismiss button', () => {
    act(() =>
      root.render(<LoadingNotification message="Done" variant="success" onDismiss={() => {}} />),
    );
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    act(() =>
      root.render(<LoadingNotification message="Done" variant="success" onDismiss={onDismiss} />),
    );
    act(() => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after autoDismissMs', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    act(() =>
      root.render(
        <LoadingNotification
          message="Done"
          variant="success"
          onDismiss={onDismiss}
          autoDismissMs={3000}
        />,
      ),
    );
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not auto-dismiss when autoDismissMs is not set', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    act(() =>
      root.render(<LoadingNotification message="Done" variant="success" onDismiss={onDismiss} />),
    );
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not auto-dismiss when sticky is true', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    act(() =>
      root.render(
        <LoadingNotification
          message="Done"
          variant="success"
          onDismiss={onDismiss}
          autoDismissMs={1000}
          sticky
        />,
      ),
    );
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('has role="status" for accessibility', () => {
    act(() =>
      root.render(<LoadingNotification message="Done" variant="success" onDismiss={() => {}} />),
    );
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
