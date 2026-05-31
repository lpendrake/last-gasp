// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { Toggle } from '../toggle';
import { SelectField } from '../select-field';
import { TextField } from '../text-field';
import { SliderField } from '../slider-field';
import { FilePickerField } from '../file-picker-field';
import { SettingRow } from '../setting-row';

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

describe('Toggle', () => {
  it('calls onChange with negated value when clicked', () => {
    setup();
    const onChange = vi.fn();
    act(() => root.render(<Toggle checked={false} onChange={onChange} />));
    act(() => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked state via aria-checked', () => {
    setup();
    act(() => root.render(<Toggle checked={true} onChange={() => {}} />));
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-checked')).toBe('true');

    act(() => root.render(<Toggle checked={false} onChange={() => {}} />));
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });
});

describe('SelectField', () => {
  it('calls onChange with the chosen option value', () => {
    setup();
    const onChange = vi.fn();
    const options = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ];
    act(() => root.render(<SelectField value="a" options={options} onChange={onChange} />));
    const select = container.querySelector('select') as HTMLSelectElement;
    act(() => {
      select.value = 'b';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('TextField', () => {
  it('calls onChange with typed value', () => {
    setup();
    const onChange = vi.fn();
    act(() => root.render(<TextField value="" onChange={onChange} />));
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      // Use the native value setter so React's synthetic event sees the new value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(input, 'hello');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('hello');
  });
});

describe('SliderField', () => {
  it('calls onChange with a numeric value', () => {
    setup();
    const onChange = vi.fn();
    act(() => root.render(<SliderField value={50} onChange={onChange} />));
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(input, '75');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(75);
    expect(typeof onChange.mock.calls[0][0]).toBe('number');
  });
});

describe('FilePickerField', () => {
  it('calls onChange with path returned by a mocked window.fsApi.selectFile', async () => {
    setup();
    const onChange = vi.fn();
    (window as unknown as { fsApi: unknown }).fsApi = {
      selectFile: vi.fn().mockResolvedValue('/some/path'),
    };
    act(() => root.render(<FilePickerField value={null} onChange={onChange} />));
    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('/some/path');
  });

  it('does NOT call onChange when the dialog returns null (cancel)', async () => {
    setup();
    const onChange = vi.fn();
    (window as unknown as { fsApi: unknown }).fsApi = {
      selectFile: vi.fn().mockResolvedValue(null),
    };
    act(() => root.render(<FilePickerField value={null} onChange={onChange} />));
    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SettingRow', () => {
  it('renders its label, description, and children', () => {
    setup();
    act(() =>
      root.render(
        <SettingRow label="My Setting" description="A helpful description">
          <span data-testid="child">control</span>
        </SettingRow>,
      ),
    );
    expect(container.textContent).toContain('My Setting');
    expect(container.textContent).toContain('A helpful description');
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});
