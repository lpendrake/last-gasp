export interface ResolveActiveThemeArgs {
  campaignOverride: string | null | undefined;
  workspaceDefault: string | null | undefined;
  validThemeIds: string[];
  fallback?: string;
}

export function resolveActiveThemeId({
  campaignOverride,
  workspaceDefault,
  validThemeIds,
  fallback = 'dark-pathfinder',
}: ResolveActiveThemeArgs): string {
  const isPresent = (value: string | null | undefined): value is string =>
    value !== null && value !== undefined && value !== '';

  if (isPresent(campaignOverride) && validThemeIds.includes(campaignOverride)) {
    return campaignOverride;
  }

  if (isPresent(workspaceDefault) && validThemeIds.includes(workspaceDefault)) {
    return workspaceDefault;
  }

  if (validThemeIds.includes(fallback)) {
    return fallback;
  }

  return 'dark-pathfinder';
}
