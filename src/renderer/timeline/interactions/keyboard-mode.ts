export type KeyboardMode = 'nav' | 'quickadd';

export type KeyAction =
  | { type: 'zoom'; dir: 'in' | 'out' }
  | { type: 'pan'; dir: 'earlier' | 'later' }
  | { type: 'nav-event'; dir: 'prev' | 'next' }
  | { type: 'quickadd-enter' }
  | { type: 'quickadd-move'; dir: 'earlier' | 'later' }
  | { type: 'quickadd-commit' }
  | { type: 'quickadd-exit' }
  | { type: 'focus-cycle'; dir: 'forward' | 'backward' }
  | { type: 'unfocus' }
  | { type: 'none' };

export interface KeyInput {
  key: string;
  shiftKey: boolean;
}

export function reduceKey(
  mode: KeyboardMode,
  input: KeyInput,
): { mode: KeyboardMode; action: KeyAction } {
  const k = input.key.length === 1 ? input.key.toLowerCase() : input.key;

  if (mode === 'nav') {
    switch (k) {
      case 'w':
        return { mode: 'nav', action: { type: 'zoom', dir: 'in' } };
      case 's':
        return { mode: 'nav', action: { type: 'zoom', dir: 'out' } };
      case 'a':
        return { mode: 'nav', action: { type: 'pan', dir: 'earlier' } };
      case 'd':
        return { mode: 'nav', action: { type: 'pan', dir: 'later' } };
      case 'q':
        return { mode: 'nav', action: { type: 'nav-event', dir: 'prev' } };
      case 'e':
        return { mode: 'nav', action: { type: 'nav-event', dir: 'next' } };
      case ' ':
        return { mode: 'quickadd', action: { type: 'quickadd-enter' } };
      case 'Tab':
        return {
          mode: 'nav',
          action: { type: 'focus-cycle', dir: input.shiftKey ? 'backward' : 'forward' },
        };
      case 'Escape':
        return { mode: 'nav', action: { type: 'unfocus' } };
      default:
        return { mode: 'nav', action: { type: 'none' } };
    }
  }

  // quickadd mode
  switch (k) {
    case 'a':
      return { mode: 'quickadd', action: { type: 'quickadd-move', dir: 'earlier' } };
    case 'd':
      return { mode: 'quickadd', action: { type: 'quickadd-move', dir: 'later' } };
    case ' ':
      return { mode: 'nav', action: { type: 'quickadd-commit' } };
    default:
      return { mode: 'nav', action: { type: 'quickadd-exit' } };
  }
}

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;

  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;

  return el.closest('input, textarea, select, [contenteditable="true"]') !== null;
}
