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

export function isValidCustomTag(tag: string): boolean {
  return !isEntityTag(tag);
}
