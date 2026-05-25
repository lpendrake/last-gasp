// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CampaignLoadOverlay } from '../campaign-load-overlay';

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

const idleProps = {
  result: 'idle' as const,
  progress: { percentage: 0, taskName: '' },
  onDismissNotification: () => {},
};

describe('CampaignLoadOverlay', () => {
  afterEach(teardown);

  it('renders nothing when result is idle', () => {
    setup();
    act(() => root.render(<CampaignLoadOverlay {...idleProps} />));
    expect(container.children).toHaveLength(0);
  });

  it('renders the loading screen when result is loading', () => {
    setup();
    act(() =>
      root.render(
        <CampaignLoadOverlay
          result="loading"
          progress={{ percentage: 40, taskName: 'Building entity index' }}
          onDismissNotification={() => {}}
        />,
      ),
    );
    expect(container.querySelector('.campaign-loading-overlay')).not.toBeNull();
    expect(container.textContent).toContain('Loading Your Universe');
  });

  it('renders the success notification when result is success', () => {
    setup();
    act(() =>
      root.render(
        <CampaignLoadOverlay
          result="success"
          progress={{ percentage: 100, taskName: '' }}
          onDismissNotification={() => {}}
        />,
      ),
    );
    expect(container.querySelector('.campaign-loading-overlay')).toBeNull();
    expect(container.textContent).toContain('Campaign loaded');
  });

  it('renders nothing when result is error', () => {
    setup();
    act(() =>
      root.render(
        <CampaignLoadOverlay
          result="error"
          progress={{ percentage: 0, taskName: '' }}
          onDismissNotification={() => {}}
        />,
      ),
    );
    expect(container.children).toHaveLength(0);
  });

  it('calls onDismissNotification when success notification is dismissed', () => {
    setup();
    const onDismiss = vi.fn();
    act(() =>
      root.render(
        <CampaignLoadOverlay
          result="success"
          progress={{ percentage: 100, taskName: '' }}
          onDismissNotification={onDismiss}
        />,
      ),
    );
    act(() => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('passes progress percentage to the loading screen', () => {
    setup();
    act(() =>
      root.render(
        <CampaignLoadOverlay
          result="loading"
          progress={{ percentage: 73, taskName: 'Scanning notes' }}
          onDismissNotification={() => {}}
        />,
      ),
    );
    const fill = container.querySelector('.campaign-loading-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('73%');
  });
});
