const ENTITY_TAG_RE = /^id:[a-z0-9]{4}$/;

export function isEntityTag(tag: string): boolean {
  return ENTITY_TAG_RE.test(tag);
}

export function parseEntityTag(tag: string): string | null {
  return ENTITY_TAG_RE.test(tag) ? tag.slice(3) : null;
}

export function formatEntityTag(id: string): string {
  return `id:${id}`;
}

export function isSessionTag(tag: string): boolean {
  return tag.startsWith('sesh:');
}

export function isValidCustomTag(tag: string): boolean {
  return !isEntityTag(tag) && !isSessionTag(tag);
}

export function resolveEntityTagLabel(
  raw: string,
  map: Map<string, string> | undefined,
): { display: string; isEntity: boolean } {
  const id = parseEntityTag(raw);
  const label = id ? map?.get(id) : undefined;
  return label !== undefined
    ? { display: label, isEntity: true }
    : { display: raw, isEntity: false };
}

const WIKI_LINK_RE = /\[\[([^\]\n]*)\]\]/g;
const ENTITY_ID_RE = /^[a-z0-9]{4}$/;

export function extractWikiLinkIds(body: string): string[] {
  const seen = new Set<string>();
  let match;
  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(body)) !== null) {
    const inner = match[1];
    const pipe = inner.indexOf('|');
    const id = (pipe === -1 ? inner : inner.slice(pipe + 1)).trim();
    if (ENTITY_ID_RE.test(id)) seen.add(id);
  }
  return Array.from(seen);
}

export function syncEntityTags(existingTags: string[], linkedEntityIds: string[]): string[] {
  const customTags = existingTags.filter((t) => !isEntityTag(t));
  const entityTags = linkedEntityIds.map(formatEntityTag);
  return [...customTags, ...entityTags];
}
