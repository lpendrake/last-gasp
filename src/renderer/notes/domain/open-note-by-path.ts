export function parseNotePath(
  campaignRelativePath: string,
): { folder: string; path: string } | null {
  const withoutPrefix = campaignRelativePath.startsWith('notes/')
    ? campaignRelativePath.slice('notes/'.length)
    : campaignRelativePath;
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx === -1) return null;
  return {
    folder: withoutPrefix.slice(0, slashIdx),
    path: withoutPrefix.slice(slashIdx + 1),
  };
}
