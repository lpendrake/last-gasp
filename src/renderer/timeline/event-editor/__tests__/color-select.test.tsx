// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { fireEvent } from '@testing-library/react';
import { ColorSelect } from '../color-select';
import type { ColorPreset } from '../../../theme/types';

const PRESETS: ColorPreset[] = [
  { label: 'Default (weekday)', value: '' },
  { label: 'Crimson', value: '#dc143c' },
  { label: 'Teal', value: '#008080' },
  { label: 'Custom…', value: '__custom__' },
];

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

function renderColorSelect(props: Partial<Parameters<typeof ColorSelect>[0]> = {}) {
  const onChange = vi.fn();
  act(() => {
    root.render(
      <ColorSelect
        presets={PRESETS}
        value=""
        weekdayColor="#aabbcc"
        onChange={onChange}
        {...props}
      />,
    );
  });
  return { onChange };
}

function getTrigger(): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('.event-editor-color-trigger');
  if (!btn) throw new Error('Trigger button not found');
  return btn;
}

function openPopover() {
  act(() => {
    fireEvent.click(getTrigger());
  });
}

function getPopover(): HTMLElement | null {
  return container.querySelector('[role="listbox"]');
}

function getOptions(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="option"]'));
}

describe('ColorSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  afterEach(() => {
    teardown();
  });

  // Test 1: trigger shows the selected preset's label
  it('trigger shows the selected preset label', () => {
    renderColorSelect({ value: '#dc143c' });
    const trigger = getTrigger();
    expect(trigger.textContent).toContain('Crimson');
  });

  // Test 2: clicking trigger opens popover with one option row per preset, each with a swatch
  it('clicking the trigger opens the popover with one row per preset, each containing a swatch', () => {
    renderColorSelect({ value: '' });
    expect(getPopover()).toBeNull();

    openPopover();

    const popover = getPopover();
    expect(popover).not.toBeNull();

    const options = getOptions();
    expect(options).toHaveLength(PRESETS.length);

    for (const opt of options) {
      const swatch = opt.querySelector('.event-editor-color-swatch-sm');
      expect(swatch).not.toBeNull();
    }
  });

  // Test 3: Default (value='') option's swatch uses weekdayColor prop
  it("the Default option's swatch uses the weekdayColor prop", () => {
    renderColorSelect({ value: '', weekdayColor: '#ff0000' });
    openPopover();

    const options = getOptions();
    const defaultOpt = options.find((o) => o.textContent?.includes('Default'));
    expect(defaultOpt).not.toBeUndefined();

    const swatch = defaultOpt!.querySelector<HTMLElement>('.event-editor-color-swatch-sm');
    expect(swatch).not.toBeNull();
    // happy-dom may preserve the raw hex string rather than converting to rgb()
    expect(swatch!.style.background).toBe('#ff0000');
  });

  // Test 4: clicking an option calls onChange with that value and closes the popover
  it('clicking an option calls onChange with its value and closes the popover', () => {
    const { onChange } = renderColorSelect({ value: '' });
    openPopover();

    const options = getOptions();
    const crimsonOpt = options.find((o) => o.textContent?.includes('Crimson'));
    expect(crimsonOpt).not.toBeUndefined();

    act(() => {
      fireEvent.click(crimsonOpt!);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#dc143c');
    expect(getPopover()).toBeNull();
  });

  // Test 5: Escape closes the popover without calling onChange
  it('Escape closes the popover without calling onChange', () => {
    const { onChange } = renderColorSelect({ value: '' });
    openPopover();
    expect(getPopover()).not.toBeNull();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });

    expect(getPopover()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
