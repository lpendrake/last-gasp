import { describe, it, expect } from 'vitest';
import { resolveInitialCursor } from '../domain/initial-cursor';
import type { EditorMode } from '../domain';

describe('resolveInitialCursor', () => {
  it('edit mode with no initialCursor returns bodyLength', () => {
    const mode: EditorMode = { kind: 'edit', filename: 'event.md' };
    expect(resolveInitialCursor(mode, 42)).toBe(42);
  });

  it('edit mode with explicit initialCursor of 0 returns 0', () => {
    const mode: EditorMode = { kind: 'edit', filename: 'event.md', initialCursor: 0 };
    expect(resolveInitialCursor(mode, 42)).toBe(0);
  });

  it('edit mode with explicit positive initialCursor returns it', () => {
    const mode: EditorMode = { kind: 'edit', filename: 'event.md', initialCursor: 7 };
    expect(resolveInitialCursor(mode, 42)).toBe(7);
  });

  it('create mode returns undefined regardless of bodyLength', () => {
    const mode: EditorMode = { kind: 'create' };
    expect(resolveInitialCursor(mode, 42)).toBeUndefined();
  });
});
