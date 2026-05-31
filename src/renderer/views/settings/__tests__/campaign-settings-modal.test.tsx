// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CampaignSettingsModal } from '../campaign-settings-modal';

// happy-dom has no scrollIntoView — stub it globally
Element.prototype.scrollIntoView = vi.fn();

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

const defaultProps = {
  campaignName: 'Test Campaign',
  onClose: vi.fn(),
};

describe('CampaignSettingsModal', () => {
  beforeEach(() => {
    defaultProps.onClose = vi.fn();
  });

  afterEach(() => {
    teardown();
  });

  it('renders all four sidebar section headers', () => {
    setup();
    act(() => root.render(<CampaignSettingsModal {...defaultProps} />));
    const sidebar = container.querySelector('nav[aria-label="Settings sections"]');
    expect(sidebar).not.toBeNull();
    const buttons = sidebar!.querySelectorAll('button');
    const labels = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(labels).toContain('Timeline');
    expect(labels).toContain('Theme');
    expect(labels).toContain('Templates');
    expect(labels).toContain('Keybindings');
  });

  it('renders the campaign name in the header', () => {
    setup();
    act(() =>
      root.render(<CampaignSettingsModal campaignName="My Cool Campaign" onClose={vi.fn()} />),
    );
    expect(container.textContent).toContain('My Cool Campaign');
  });

  it('pressing Escape calls onClose', () => {
    setup();
    const onClose = vi.fn();
    act(() => root.render(<CampaignSettingsModal campaignName="Test" onClose={onClose} />));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking the backdrop calls onClose; clicking inside the panel does NOT', () => {
    setup();
    const onClose = vi.fn();
    act(() => root.render(<CampaignSettingsModal campaignName="Test" onClose={onClose} />));

    // Click on the overlay element itself (backdrop)
    const overlay = container.querySelector('.campaign-settings-overlay') as HTMLElement;
    act(() => {
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();

    onClose.mockClear();

    // Click inside the panel — should NOT call onClose
    const modal = container.querySelector('.campaign-settings-modal') as HTMLElement;
    act(() => {
      modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking the footer Close button calls onClose', () => {
    // The Close button portals into #footer-slot-settings which only exists when
    // the real Footer is mounted. Create and tear down the target div in isolation.
    const slotDiv = document.createElement('div');
    slotDiv.id = 'footer-slot-settings';
    document.body.appendChild(slotDiv);

    setup();
    const onCloseFn = vi.fn();
    act(() => root.render(<CampaignSettingsModal campaignName="Test" onClose={onCloseFn} />));

    const closeBtn = document
      .getElementById('footer-slot-settings')!
      .querySelector('button') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });
    expect(onCloseFn).toHaveBeenCalledOnce();

    slotDiv.remove();
  });

  it('clicking a sidebar header calls scrollIntoView on the matching section', () => {
    setup();
    act(() => root.render(<CampaignSettingsModal {...defaultProps} />));

    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scrollSpy.mockClear();

    // Find the "Templates" sidebar button and click it
    const sidebar = container.querySelector('nav[aria-label="Settings sections"]')!;
    const templatesBtn = Array.from(sidebar.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Templates',
    ) as HTMLButtonElement;

    act(() => {
      templatesBtn.click();
    });

    expect(scrollSpy).toHaveBeenCalledOnce();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('Templates section renders dummy template titles; clicking the first reveals the markdown editor', () => {
    setup();
    act(() => root.render(<CampaignSettingsModal {...defaultProps} />));

    const templatesSection = container.querySelector('#templates')!;
    expect(templatesSection).not.toBeNull();

    // All three template titles should appear as accordion headers
    const accordionHeaders = templatesSection.querySelectorAll('.accordion__header');
    expect(accordionHeaders.length).toBeGreaterThanOrEqual(3);

    // No editor mounted yet
    expect(templatesSection.querySelector('.markdown-editor-container')).toBeNull();

    // Click the first accordion header
    const firstHeader = accordionHeaders[0] as HTMLButtonElement;
    act(() => {
      firstHeader.click();
    });

    // The markdown editor container should now be in the DOM
    expect(templatesSection.querySelector('.markdown-editor-container')).not.toBeNull();
  });
});
