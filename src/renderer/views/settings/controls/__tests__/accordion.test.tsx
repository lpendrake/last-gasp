// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { Accordion, type AccordionItem } from '../accordion';

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

afterEach(() => {
  teardown();
});

const ITEMS: AccordionItem[] = [
  { id: 'a', title: 'Item A' },
  { id: 'b', title: 'Item B' },
  { id: 'c', title: 'Item C' },
];

function renderBody(id: string) {
  return <div data-testid={`body-${id}`}>body {id}</div>;
}

describe('Accordion', () => {
  it('renders all item titles', () => {
    setup();
    act(() => root.render(<Accordion items={ITEMS} renderBody={renderBody} />));
    const titleEls = container.querySelectorAll('.accordion__title');
    const titles = Array.from(titleEls).map((el) => el.textContent?.trim());
    expect(titles).toContain('Item A');
    expect(titles).toContain('Item B');
    expect(titles).toContain('Item C');
  });

  it('clicking a header opens it and its body appears in the DOM', () => {
    setup();
    act(() => root.render(<Accordion items={ITEMS} renderBody={renderBody} />));

    // No body visible initially
    expect(container.querySelector('[data-testid="body-a"]')).toBeNull();

    const headerA = Array.from(container.querySelectorAll('.accordion__header')).find((h) =>
      h.textContent?.includes('Item A'),
    ) as HTMLButtonElement;

    act(() => {
      headerA.click();
    });

    expect(container.querySelector('[data-testid="body-a"]')).not.toBeNull();
    expect(headerA.getAttribute('aria-expanded')).toBe('true');
  });

  it('opening a second item closes the first (only one body in DOM)', () => {
    setup();
    act(() => root.render(<Accordion items={ITEMS} renderBody={renderBody} />));

    const [headerA, headerB] = Array.from(
      container.querySelectorAll('.accordion__header'),
    ) as HTMLButtonElement[];

    act(() => {
      headerA.click();
    });
    expect(container.querySelector('[data-testid="body-a"]')).not.toBeNull();

    act(() => {
      headerB.click();
    });

    // A is closed, B is open
    expect(container.querySelector('[data-testid="body-a"]')).toBeNull();
    expect(container.querySelector('[data-testid="body-b"]')).not.toBeNull();

    // Only one body in the DOM total
    expect(container.querySelectorAll('.accordion__body').length).toBe(1);
  });

  it('clicking the open header closes it (no body in DOM)', () => {
    setup();
    act(() => root.render(<Accordion items={ITEMS} renderBody={renderBody} />));

    const headerA = Array.from(container.querySelectorAll('.accordion__header')).find((h) =>
      h.textContent?.includes('Item A'),
    ) as HTMLButtonElement;

    act(() => {
      headerA.click();
    });
    expect(container.querySelector('[data-testid="body-a"]')).not.toBeNull();

    act(() => {
      headerA.click();
    });
    expect(container.querySelector('[data-testid="body-a"]')).toBeNull();
    expect(headerA.getAttribute('aria-expanded')).toBe('false');
  });

  it('renderBody is NOT called for closed items (only the open id is rendered)', () => {
    setup();
    const renderBodySpy = vi.fn((id: string) => <div data-testid={`body-${id}`}>body {id}</div>);

    act(() => root.render(<Accordion items={ITEMS} renderBody={renderBodySpy} />));

    // Nothing open yet — renderBody should not have been called
    expect(renderBodySpy).not.toHaveBeenCalled();

    const headerA = Array.from(container.querySelectorAll('.accordion__header')).find((h) =>
      h.textContent?.includes('Item A'),
    ) as HTMLButtonElement;

    act(() => {
      headerA.click();
    });

    // renderBody should have been called exactly once, for 'a'
    expect(renderBodySpy).toHaveBeenCalledTimes(1);
    expect(renderBodySpy).toHaveBeenCalledWith('a');
  });
});
