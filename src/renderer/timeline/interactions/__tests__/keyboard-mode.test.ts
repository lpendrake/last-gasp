// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { reduceKey, isTypingTarget } from '../keyboard-mode';

describe('keyboard-mode', () => {
  it('nav: w/s map to zoom in/out', () => {
    expect(reduceKey('nav', { key: 'w', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'zoom', dir: 'in' },
    });
    expect(reduceKey('nav', { key: 's', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'zoom', dir: 'out' },
    });
  });

  it('nav: a/d map to pan earlier/later', () => {
    expect(reduceKey('nav', { key: 'a', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'pan', dir: 'earlier' },
    });
    expect(reduceKey('nav', { key: 'd', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'pan', dir: 'later' },
    });
  });

  it('nav: space enters quickadd mode with quickadd-enter', () => {
    expect(reduceKey('nav', { key: ' ', shiftKey: false })).toEqual({
      mode: 'quickadd',
      action: { type: 'quickadd-enter' },
    });
  });

  it('quickadd: a/d map to quickadd-move and stay in quickadd', () => {
    expect(reduceKey('quickadd', { key: 'a', shiftKey: false })).toEqual({
      mode: 'quickadd',
      action: { type: 'quickadd-move', dir: 'earlier' },
    });
    expect(reduceKey('quickadd', { key: 'd', shiftKey: false })).toEqual({
      mode: 'quickadd',
      action: { type: 'quickadd-move', dir: 'later' },
    });
  });

  it('quickadd: space commits and returns to nav', () => {
    expect(reduceKey('quickadd', { key: ' ', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'quickadd-commit' },
    });
  });

  it('quickadd: escape exits to nav with quickadd-exit', () => {
    expect(reduceKey('quickadd', { key: 'Escape', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'quickadd-exit' },
    });
  });

  it('nav: Tab/Shift+Tab produce focus-cycle forward/backward', () => {
    expect(reduceKey('nav', { key: 'Tab', shiftKey: false })).toEqual({
      mode: 'nav',
      action: { type: 'focus-cycle', dir: 'forward' },
    });
    expect(reduceKey('nav', { key: 'Tab', shiftKey: true })).toEqual({
      mode: 'nav',
      action: { type: 'focus-cycle', dir: 'backward' },
    });
  });

  it('isTypingTarget true for input/textarea/contenteditable, false for a plain div', () => {
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);

    const textarea = document.createElement('textarea');
    expect(isTypingTarget(textarea)).toBe(true);

    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    expect(isTypingTarget(ce)).toBe(true);

    const plain = document.createElement('div');
    expect(isTypingTarget(plain)).toBe(false);
  });
});
