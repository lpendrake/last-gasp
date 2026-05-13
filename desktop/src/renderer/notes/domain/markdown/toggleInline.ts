/**
 * Toggle an inline markdown marker around a selection.
 *
 * Signature:
 *   toggleInline(text, from, to, marker) → { text, from, to }
 *
 * Contracts:
 * - Wrap:     returned [from, to] covers the content inside the new markers.
 * - Unwrap:   returned [from, to] covers the content in the shorter text.
 * - Caret (from === to): inserts marker pair; returned from === to === oldFrom + marker.length.
 *
 * Star stacking ('**' / '*'):
 * - Consecutive '*' characters immediately surrounding the selection are counted.
 * - Bold (delta 2) is active when count ≥ 2; italic (delta 1) when count is odd.
 * - Active  → remove delta stars from both sides.
 * - Inactive → add delta stars to both sides (existing stars are preserved / merged).
 * - Asymmetric star counts (malformed input) → always wrap, don't touch existing stars.
 *
 * Symmetric markers ('~~', '`'):
 * - Exact marker present on both sides → unwrap.
 * - Otherwise → wrap.
 */
export function toggleInline(
  text: string,
  from: number,
  to: number,
  marker: '**' | '*' | '`' | '~~',
): { text: string; from: number; to: number } {
  if (marker === '**' || marker === '*') {
    return toggleStars(text, from, to, marker === '**' ? 2 : 1);
  }
  return toggleSymmetric(text, from, to, marker);
}

// ---- Convenience wrappers ------------------------------------------------

export const toggleBold = (t: string, f: number, to: number) => toggleInline(t, f, to, '**');
export const toggleItalic = (t: string, f: number, to: number) => toggleInline(t, f, to, '*');
export const toggleCode = (t: string, f: number, to: number) => toggleInline(t, f, to, '`');
export const toggleStrike = (t: string, f: number, to: number) => toggleInline(t, f, to, '~~');

// ---- Internals -----------------------------------------------------------

function countStarsBefore(text: string, pos: number): number {
  let count = 0;
  let i = pos - 1;
  while (i >= 0 && text[i] === '*') {
    count++;
    i--;
  }
  return count;
}

function countStarsAfter(text: string, pos: number): number {
  let count = 0;
  let i = pos;
  while (i < text.length && text[i] === '*') {
    count++;
    i++;
  }
  return count;
}

/**
 * Returns whether a given star count has the requested marker "active":
 * - bold  (delta 2): active when count ≥ 2
 * - italic (delta 1): active when count is odd
 */
function isStarMarkerActive(count: number, delta: 1 | 2): boolean {
  return delta === 2 ? count >= 2 : count % 2 === 1;
}

function toggleStars(
  text: string,
  from: number,
  to: number,
  delta: 1 | 2,
): { text: string; from: number; to: number } {
  const before = countStarsBefore(text, from);
  const after = countStarsAfter(text, to);

  if (before !== after) {
    // Asymmetric — just insert without touching existing stars.
    const newText =
      text.slice(0, from) +
      '*'.repeat(delta) +
      text.slice(from, to) +
      '*'.repeat(delta) +
      text.slice(to);
    return { text: newText, from: from + delta, to: to + delta };
  }

  const current = before; // === after
  const targetStars = isStarMarkerActive(current, delta)
    ? current - delta // unwrap: remove this marker's contribution
    : current + delta; // wrap:   add this marker

  const markerStart = from - current;
  const markerEnd = to + current;
  const content = text.slice(from, to);
  const newMarker = '*'.repeat(targetStars);
  const newText =
    text.slice(0, markerStart) + newMarker + content + newMarker + text.slice(markerEnd);

  const newFrom = markerStart + targetStars;
  return { text: newText, from: newFrom, to: newFrom + content.length };
}

function toggleSymmetric(
  text: string,
  from: number,
  to: number,
  marker: string,
): { text: string; from: number; to: number } {
  const len = marker.length;
  const before = from >= len ? text.slice(from - len, from) : '';
  const after = text.slice(to, to + len);

  if (before === marker && after === marker) {
    // Unwrap
    const newText = text.slice(0, from - len) + text.slice(from, to) + text.slice(to + len);
    return { text: newText, from: from - len, to: to - len };
  }

  // Wrap
  const newText = text.slice(0, from) + marker + text.slice(from, to) + marker + text.slice(to);
  return { text: newText, from: from + len, to: to + len };
}
