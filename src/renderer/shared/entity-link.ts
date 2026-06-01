/** Wiki link to an entity (note or event) by its 4-char id, e.g. `[[ab12]]`. */
export function buildEntityLink(id: string): string {
  return `[[${id}]]`;
}

/**
 * Markdown embed for an asset, matching the editor's autocomplete output.
 * @param campaignRelPath campaign-relative path, e.g. "notes/maps/m.png"
 * @param label display label shown in the embed
 */
export function buildAssetLink(campaignRelPath: string, label: string): string {
  return `![${label}](notes-asset://current/${campaignRelPath})`;
}
