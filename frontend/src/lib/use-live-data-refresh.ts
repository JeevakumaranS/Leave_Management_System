'use client';

import { useEffect, useRef } from 'react';
import { DATA_UPDATED_EVENT, DATA_UPDATED_STORAGE_KEY } from './data-update-events';

const REFRESH_INTERVAL_MS = 15_000;

export function useLiveDataRefresh(
  refreshData: () => void | Promise<void>,
  enabled = true,
) {
  const refreshDataRef = useRef(refreshData);
  const refreshInProgressRef = useRef(false);

  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  useEffect(() => {
    if (!enabled) return;

    const refresh = async () => {
      if (document.visibilityState === 'hidden' || refreshInProgressRef.current) return;
      refreshInProgressRef.current = true;
      try {
        await refreshDataRef.current();
      } catch (error) {
        console.error('Automatic LMS data refresh failed.', error);
      } finally {
        refreshInProgressRef.current = false;
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DATA_UPDATED_STORAGE_KEY) void refresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener(DATA_UPDATED_EVENT, refresh);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener(DATA_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [enabled]);
}
