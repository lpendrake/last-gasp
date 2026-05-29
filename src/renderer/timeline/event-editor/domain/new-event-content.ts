// When a template is provided (non-empty, non-whitespace), every occurrence of
// the literal token <title> in the template is replaced by the event title, and
// the cursor is placed at the end of the resulting body.
// When no template is supplied the body defaults to `# <title>\n\n` with the
// cursor at the end.

/**
 * Builds the starting body content for a newly created event.
 *
 * If `template` is a non-empty, non-whitespace string, the body is the
 * template with every occurrence of `<title>` replaced by `title`, and
 * `cursorOffset` is set to `body.length` (end of file).
 *
 * Otherwise the body defaults to `# ${title}\n\n` with `cursorOffset` at
 * the end, ready for the user to start typing.
 */
export function buildNewEventContent(
  title: string,
  template?: string | null,
): { body: string; cursorOffset: number } {
  if (template != null && template.trim().length > 0) {
    const body = template.split('<title>').join(title);
    return { body, cursorOffset: body.length };
  }
  const body = `# ${title}\n\n`;
  return { body, cursorOffset: body.length };
}

export function duplicateEventMessage(title: string): string {
  return `An event titled "${title}" already exists at that time — pick a different title.`;
}
