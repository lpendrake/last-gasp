import { useState, useEffect, useCallback } from 'react';
import { Campaign, EntityIndexEntry } from '../../types/global';

export function useCampaigns() {
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [loadProgress, setLoadProgress] = useState({ percentage: 0, taskName: '' });
  const [loadResult, setLoadResult] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingEntityIndex, setPendingEntityIndex] = useState<EntityIndexEntry[] | null>(null);

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

  useEffect(() => {
    const unsubProgress = window.fsApi.onLoadProgress((data) => {
      setLoadProgress(data);
    });
    // onLoadComplete and onLoadError are belt-and-suspenders channels defined in
    // the preload. The invoke response from openCampaign is authoritative for both
    // success and error; we subscribe here only to stream progress updates.
    const unsubComplete = window.fsApi.onLoadComplete(() => {});
    const unsubError = window.fsApi.onLoadError(() => {});
    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, []);

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
    setLoadResult('loading');
    setLoadProgress({ percentage: 0, taskName: '' });
    setLoadError(null);
    setPendingEntityIndex(null);

    const result = await window.fsApi.openCampaign(campaign.path);
    if (result.success) {
      setPendingEntityIndex(result.entityIndex);
      setActiveCampaign(campaign);
      setLoadResult('success');
    } else {
      setLoadResult('error');
      setLoadError(result.error);
    }
  };

  const handleCloseCampaign = async () => {
    await window.fsApi.closeCampaign();
    setActiveCampaign(null);
    setPendingEntityIndex(null);
    setLoadResult('idle');
  };

  const dismissLoadNotification = useCallback(() => {
    setLoadResult('idle');
  }, []);

  return {
    rootDir,
    campaigns,
    activeCampaign,
    isLoading,
    loadProgress,
    loadResult,
    loadError,
    pendingEntityIndex,
    dismissLoadNotification,
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
