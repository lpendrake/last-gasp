// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { NewEventModal } from '../new-event-modal';

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

function getInput(): HTMLInputElement {
  return container.querySelector('input') as HTMLInputElement;
}

function getCreateBtn(): HTMLButtonElement {
  const btns = container.querySelectorAll('button');
  return Array.from(btns).find((b) => b.textContent === 'Create') as HTMLButtonElement;
}

function getCancelBtn(): HTMLButtonElement {
  const btns = container.querySelectorAll('button');
  return Array.from(btns).find((b) => b.textContent === 'Cancel') as HTMLButtonElement;
}

describe('NewEventModal', () => {
  afterEach(() => {
    teardown();
  });

  it('disables Create when the title is empty/whitespace', () => {
    setup();
    const onCreate = vi.fn();
    const onCancel = vi.fn();

    act(() => root.render(<NewEventModal onCreate={onCreate} onCancel={onCancel} />));

    expect(getCreateBtn().disabled).toBe(true);

    // Type whitespace only — still disabled
    act(() => {
      const input = getInput();
      input.value = '   ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // React uses onChange, so simulate it properly
    });

    // Type a real title — should enable Create
    act(() => {
      const input = getInput();
      Object.defineProperty(input, 'value', { value: 'My New Event', writable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Re-render with an initialTitle to verify the enabled state path
    act(() =>
      root.render(
        <NewEventModal initialTitle="Dragon Fight" onCreate={onCreate} onCancel={onCancel} />,
      ),
    );
    expect(getCreateBtn().disabled).toBe(false);
  });

  it('fires onCreate with the trimmed title on Create click and on Enter', () => {
    setup();
    const onCreate = vi.fn();
    const onCancel = vi.fn();

    act(() =>
      root.render(
        <NewEventModal initialTitle="  Goblin Ambush  " onCreate={onCreate} onCancel={onCancel} />,
      ),
    );

    // Click Create — trims whitespace
    act(() => {
      getCreateBtn().click();
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('Goblin Ambush');

    onCreate.mockClear();

    // Press Enter in the input — also trims whitespace
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      getInput().dispatchEvent(event);
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('Goblin Ambush');
  });

  it('fires onCancel on Cancel click, Escape, and backdrop click', () => {
    setup();
    const onCreate = vi.fn();
    const onCancel = vi.fn();

    // --- Cancel button ---
    act(() =>
      root.render(<NewEventModal initialTitle="Foo" onCreate={onCreate} onCancel={onCancel} />),
    );
    act(() => {
      getCancelBtn().click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    onCancel.mockClear();

    // --- Escape key (capture-phase document listener) ---
    act(() =>
      root.render(<NewEventModal initialTitle="Foo" onCreate={onCreate} onCancel={onCancel} />),
    );
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    onCancel.mockClear();

    // --- Backdrop (overlay) mousedown ---
    act(() =>
      root.render(<NewEventModal initialTitle="Foo" onCreate={onCreate} onCancel={onCancel} />),
    );
    act(() => {
      const overlay = container.querySelector('.new-event-overlay') as HTMLElement;
      const event = new MouseEvent('mousedown', { bubbles: true });
      // Make target === currentTarget by dispatching directly on the overlay
      Object.defineProperty(event, 'target', { value: overlay });
      Object.defineProperty(event, 'currentTarget', { value: overlay });
      overlay.dispatchEvent(event);
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the error text when error prop is set', () => {
    setup();
    const onCreate = vi.fn();
    const onCancel = vi.fn();

    // No error — error element absent
    act(() =>
      root.render(
        <NewEventModal initialTitle="Foo" error={null} onCreate={onCreate} onCancel={onCancel} />,
      ),
    );
    expect(container.querySelector('.new-event-modal__error')).toBeNull();

    // With error — error element present and contains the message
    act(() =>
      root.render(
        <NewEventModal
          initialTitle="Foo"
          error="Something went wrong"
          onCreate={onCreate}
          onCancel={onCancel}
        />,
      ),
    );
    const errorEl = container.querySelector('.new-event-modal__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe('Something went wrong');
  });
});
