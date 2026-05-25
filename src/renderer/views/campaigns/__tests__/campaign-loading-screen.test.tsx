// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CampaignLoadingScreen } from '../campaign-loading-screen';

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

describe('CampaignLoadingScreen', () => {
  afterEach(teardown);

  it('renders the title', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={50} taskName="Loading events" />));
    expect(container.querySelector('h2')?.textContent).toBe('Loading Your Universe');
  });

  it('renders the task name', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={30} taskName="Parsing notes" />));
    expect(container.textContent).toContain('Parsing notes');
  });

  it('sets progress bar width to the given percentage', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={75} taskName="Loading" />));
    const fill = container.querySelector('.campaign-loading-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('75%');
  });

  it('clamps percentage below 0 to 0', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={-10} taskName="Loading" />));
    const fill = container.querySelector('.campaign-loading-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('clamps percentage above 100 to 100', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={120} taskName="Loading" />));
    const fill = container.querySelector('.campaign-loading-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('exposes progressbar role with aria attributes', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={40} taskName="Loading" />));
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuenow')).toBe('40');
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('has no close button', () => {
    setup();
    act(() => root.render(<CampaignLoadingScreen percentage={50} taskName="Loading" />));
    expect(container.querySelector('button')).toBeNull();
  });
});
