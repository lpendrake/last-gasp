// Seam for #204 (Event Template System): this fallback will be replaced by reading
// /templates/event.md and substituting the title + template-defined cursor position.

/**
 * Builds the starting body content for a newly created event.
 *
 * Returns the title as an H1 on line 1, followed by a blank line.
 * The cursorOffset is placed at the end of the body (on the blank line
 * under the heading), ready for the user to start typing.
 */
export function buildNewEventContent(title: string): { body: string; cursorOffset: number } {
  const body = `# ${title}\n\n`;
  return { body, cursorOffset: body.length };
}
