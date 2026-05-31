export const themeSettingsData = {
  async getWorkspaceDefaultTheme(rootDir: string): Promise<string | null> {
    return window.fsApi.getWorkspaceDefaultTheme(rootDir);
  },

  async setWorkspaceDefaultTheme(rootDir: string, themeId: string): Promise<void> {
    return window.fsApi.setWorkspaceDefaultTheme(rootDir, themeId);
  },

  async getCampaignTheme(campaignPath: string): Promise<string | null> {
    return window.fsApi.getCampaignTheme(campaignPath);
  },

  async setCampaignTheme(campaignPath: string, themeId: string | null): Promise<void> {
    return window.fsApi.setCampaignTheme(campaignPath, themeId);
  },

  async getCampaignThemeOverrides(campaignPaths: string[]): Promise<Record<string, string>> {
    return window.fsApi.getCampaignThemeOverrides(campaignPaths);
  },
};
