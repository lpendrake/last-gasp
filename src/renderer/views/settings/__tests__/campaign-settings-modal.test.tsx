// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CampaignSettingsModal } from '../campaign-settings-modal';
import type { Campaign } from '../../../../types/global';

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

const mockCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Alpha Campaign',
    description: '',
    folderName: 'alpha',
    path: '/campaigns/alpha',
  },
  { id: 'c2', name: 'Beta Campaign', description: '', folderName: 'beta', path: '/campaigns/beta' },
];

const mockActiveCampaign = mockCampaigns[0];
const mockRootDir = '/root';

const defaultProps = {
  campaignName: 'Test Campaign',
  onClose: vi.fn(),
  campaigns: mockCampaigns,
  activeCampaign: mockActiveCampaign,
  rootDir: mockRootDir,
};

function setupFsApiMocks() {
  Object.defineProperty(window, 'fsApi', {
    configurable: true,
    value: {
      getWorkspaceDefaultTheme: vi.fn().mockResolvedValue('dark-pathfinder'),
      setWorkspaceDefaultTheme: vi.fn().mockResolvedValue(undefined),
      getCampaignTheme: vi.fn().mockResolvedValue(null),
      setCampaignTheme: vi.fn().mockResolvedValue(undefined),
      getCampaignThemeOverrides: vi.fn().mockResolvedValue({}),
    },
  });
}

describe('CampaignSettingsModal', () => {
  beforeEach(() => {
    defaultProps.onClose = vi.fn();
    setupFsApiMocks();
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
      root.render(
        <CampaignSettingsModal
          campaignName="My Cool Campaign"
          onClose={vi.fn()}
          campaigns={mockCampaigns}
          activeCampaign={mockActiveCampaign}
          rootDir={mockRootDir}
        />,
      ),
    );
    expect(container.textContent).toContain('My Cool Campaign');
  });

  it('pressing Escape calls onClose', () => {
    setup();
    const onClose = vi.fn();
    act(() =>
      root.render(
        <CampaignSettingsModal
          campaignName="Test"
          onClose={onClose}
          campaigns={mockCampaigns}
          activeCampaign={mockActiveCampaign}
          rootDir={mockRootDir}
        />,
      ),
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking the backdrop calls onClose; clicking inside the panel does NOT', () => {
    setup();
    const onClose = vi.fn();
    act(() =>
      root.render(
        <CampaignSettingsModal
          campaignName="Test"
          onClose={onClose}
          campaigns={mockCampaigns}
          activeCampaign={mockActiveCampaign}
          rootDir={mockRootDir}
        />,
      ),
    );

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
    act(() =>
      root.render(
        <CampaignSettingsModal
          campaignName="Test"
          onClose={onCloseFn}
          campaigns={mockCampaigns}
          activeCampaign={mockActiveCampaign}
          rootDir={mockRootDir}
        />,
      ),
    );

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

  it('Theme section renders the default theme picker and "Specify campaign theme" button', () => {
    setup();
    act(() => root.render(<CampaignSettingsModal {...defaultProps} />));

    const themeSection = container.querySelector('#theme')!;
    expect(themeSection).not.toBeNull();

    // The "Specify campaign theme" button should be present
    const addBtn = Array.from(themeSection.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Specify campaign theme'),
    );
    expect(addBtn).not.toBeUndefined();

    // The default theme select should be present
    const defaultSelect = themeSection.querySelector('#theme-default-select');
    expect(defaultSelect).not.toBeNull();
  });

  it('clicking "Specify campaign theme" adds an override row', async () => {
    setup();
    await act(async () => {
      root.render(<CampaignSettingsModal {...defaultProps} />);
    });

    const themeSection = container.querySelector('#theme')!;

    const addBtn = Array.from(themeSection.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Specify campaign theme'),
    ) as HTMLButtonElement;

    expect(themeSection.querySelectorAll('.theme-override-row')).toHaveLength(0);

    await act(async () => {
      addBtn.click();
    });

    expect(themeSection.querySelectorAll('.theme-override-row')).toHaveLength(1);
  });

  it('selecting a theme in an override row calls setCampaignTheme', async () => {
    setup();
    await act(async () => {
      root.render(<CampaignSettingsModal {...defaultProps} />);
    });

    const themeSection = container.querySelector('#theme')!;

    const addBtn = Array.from(themeSection.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Specify campaign theme'),
    ) as HTMLButtonElement;

    await act(async () => {
      addBtn.click();
    });

    const overrideRow = themeSection.querySelector('.theme-override-row')!;
    // The last select in the row is the theme select
    const selects = overrideRow.querySelectorAll('select');
    const themeSelect = selects[selects.length - 1] as HTMLSelectElement;

    await act(async () => {
      themeSelect.value = 'lightfinder';
      themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(window.fsApi.setCampaignTheme).toHaveBeenCalledWith(
      mockActiveCampaign.path,
      'lightfinder',
    );
  });
});
