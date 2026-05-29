import type { EditorMode } from '../domain';

/**
 * Resolves the caret offset the editor should open at.
 * Edit mode defaults the caret to the end of the body (bodyLength) unless an
 * explicit cursor was supplied (e.g. immediately after creating an event).
 * Create mode keeps the default (undefined → caret at 0).
 */
export function resolveInitialCursor(mode: EditorMode, bodyLength: number): number | undefined {
  if (mode.kind === 'edit') {
    return mode.initialCursor ?? bodyLength;
  }
  return undefined;
}
