import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../../types/global';

export function useCampaigns() {
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    const savedRootDir = await window.fsApi.getRootDir();
    setRootDir(savedRootDir);
    if (savedRootDir) {
      const list = await window.fsApi.scanCampaigns(savedRootDir);
      setCampaigns(list);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSetRootDir = async (path: string) => {
    await window.fsApi.setRootDir(path);
    setRootDir(path);
    const list = await window.fsApi.scanCampaigns(path);
    setCampaigns(list);
  };

  const handleCreateCampaign = async (name: string, description: string) => {
    if (!rootDir) return { success: false, error: 'No root directory set' };
    const result = await window.fsApi.createCampaign(rootDir, name, description);
    if (result.success) {
      const list = await window.fsApi.scanCampaigns(rootDir);
      setCampaigns(list);
    }
    return result;
  };

  const handleOpenCampaign = async (campaign: Campaign) => {
    const success = await window.fsApi.openCampaign(campaign.path);
    if (success) {
      setActiveCampaign(campaign);
    }
    return success;
  };

  const handleCloseCampaign = async () => {
    await window.fsApi.closeCampaign();
    setActiveCampaign(null);
  };

  return {
    rootDir,
    campaigns,
    activeCampaign,
    isLoading,
    handleSetRootDir,
    handleCreateCampaign,
    handleOpenCampaign,
    handleCloseCampaign,
    refreshCampaigns: async () => {
      if (rootDir) {
        const list = await window.fsApi.scanCampaigns(rootDir);
        setCampaigns(list);
      }
    },
  };
}
