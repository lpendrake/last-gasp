import { describe, it, expect } from 'vitest';
import { isCursorNear } from '../decorations';

describe('isCursorNear', () => {
  // Element spans positions 5–10 (exclusive end)
  const from = 5;
  const to = 10;

  it('returns true when cursor is inside the element', () => {
    expect(isCursorNear(5, from, to)).toBe(true); // at start
    expect(isCursorNear(7, from, to)).toBe(true); // middle
    expect(isCursorNear(9, from, to)).toBe(true); // at last char
  });

  it('returns true when cursor is at the exclusive end (adjacent after)', () => {
    expect(isCursorNear(10, from, to)).toBe(true);
  });

  it('returns false when cursor is one position before the element', () => {
    // Being at the \n character before an element must NOT reveal its markers.
    expect(isCursorNear(4, from, to)).toBe(false);
  });

  it('returns false when cursor is two or more positions before', () => {
    expect(isCursorNear(3, from, to)).toBe(false);
    expect(isCursorNear(0, from, to)).toBe(false);
  });

  it('returns false when cursor is past the end', () => {
    expect(isCursorNear(11, from, to)).toBe(false);
    expect(isCursorNear(20, from, to)).toBe(false);
  });

  it('handles element at document start (from === 0)', () => {
    expect(isCursorNear(0, 0, 3)).toBe(true);
    expect(isCursorNear(3, 0, 3)).toBe(true);
    expect(isCursorNear(4, 0, 3)).toBe(false);
  });
});
