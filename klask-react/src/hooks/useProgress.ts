import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { CrawlProgressInfo } from '../types';

export interface UseProgressOptions {
  repositoryId?: string;
  pollingInterval?: number; // ms, default 2000 (2 seconds)
  enabled?: boolean;
}

export interface UseProgressReturn {
  progress: CrawlProgressInfo | null;
  activeProgress: CrawlProgressInfo[];
  isLoading: boolean;
  error: string | null;
  refreshProgress: () => Promise<void>;
  refreshActiveProgress: () => Promise<void>;
}

export function useProgress({
  repositoryId,
  pollingInterval = 2000,
  enabled = true
}: UseProgressOptions = {}): UseProgressReturn {
  const [progress, setProgress] = useState<CrawlProgressInfo | null>(null);
  const [activeProgress, setActiveProgress] = useState<CrawlProgressInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch progress for a specific repository
  const refreshProgress = useCallback(async () => {
    if (!repositoryId || !enabled) return;

    try {
      setIsLoading(true);
      setError(null);
      const progressData = await api.getRepositoryProgress(repositoryId);
      setProgress(progressData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch progress';
      setError(errorMessage);
      console.error('Error fetching repository progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, [repositoryId, enabled]);

  // Fetch all active progress
  const refreshActiveProgress = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);
      const activeProgressData = await api.getActiveProgress();
      setActiveProgress(activeProgressData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch active progress';
      setError(errorMessage);
      console.error('Error fetching active progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // Poll repository progress with intelligent interval
  useEffect(() => {
    if (!repositoryId || !enabled) return;

    let intervalId: NodeJS.Timeout;

    const pollProgress = async () => {
      await refreshProgress();
    };

    const scheduleNextPoll = () => {
      // Intelligent polling: fast when crawling, slow when idle
      const isCurrentlyActive = progress && !['completed', 'failed', 'cancelled'].includes(progress.status.toLowerCase());
      const smartInterval = isCurrentlyActive ? pollingInterval : Math.max(pollingInterval * 5, 10000); // 2s -> 10s when idle
      
      intervalId = setTimeout(async () => {
        if (!document.hidden) {
          await pollProgress();
        }
        scheduleNextPoll();
      }, smartInterval);
    };

    // Initial fetch
    pollProgress();

    // Start intelligent polling
    if (pollingInterval > 0) {
      scheduleNextPoll();
    }

    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [repositoryId, pollingInterval, enabled, refreshProgress, progress?.status]);

  // Poll active progress with intelligent interval
  useEffect(() => {
    if (!enabled) return;

    let intervalId: NodeJS.Timeout;

    const pollActiveProgress = async () => {
      await refreshActiveProgress();
    };

    const scheduleNextPoll = () => {
      // Intelligent polling: fast when crawls are active, slow when idle
      const hasActiveCrawls = activeProgress.length > 0;
      const smartInterval = hasActiveCrawls ? pollingInterval : Math.max(pollingInterval * 7.5, 15000); // 2s -> 15s when idle
      
      intervalId = setTimeout(async () => {
        // Don't poll when tab is not visible (save resources)
        if (!document.hidden) {
          await pollActiveProgress();
        }
        scheduleNextPoll(); // Schedule next poll
      }, smartInterval);
    };

    // Initial fetch
    pollActiveProgress();

    // Start intelligent polling
    if (pollingInterval > 0) {
      scheduleNextPoll();
    }

    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [pollingInterval, enabled, refreshActiveProgress, activeProgress.length]);

  return {
    progress,
    activeProgress,
    isLoading,
    error,
    refreshProgress,
    refreshActiveProgress,
  };
}

// Specific hook for repository progress
export function useRepositoryProgress(
  repositoryId: string,
  options: Omit<UseProgressOptions, 'repositoryId'> = {}
): Omit<UseProgressReturn, 'activeProgress' | 'refreshActiveProgress'> {
  const { progress, isLoading, error, refreshProgress } = useProgress({
    repositoryId,
    ...options,
  });

  return {
    progress,
    isLoading,
    error,
    refreshProgress,
  };
}

// Specific hook for active progress across all repositories
export function useActiveProgress(
  options: Omit<UseProgressOptions, 'repositoryId'> = {}
): Omit<UseProgressReturn, 'progress' | 'refreshProgress'> {
  const { activeProgress, isLoading, error, refreshActiveProgress } = useProgress({
    repositoryId: undefined,
    ...options,
  });

  return {
    activeProgress,
    isLoading,
    error,
    refreshActiveProgress,
  };
}

// Utility function to check if a repository is currently crawling
export function isRepositoryCrawling(repositoryId: string, activeProgress: CrawlProgressInfo[]): boolean {
  return activeProgress.some(
    progress => 
      progress.repository_id === repositoryId && 
      !['completed', 'failed', 'cancelled'].includes(progress.status.toLowerCase())
  );
}

// Utility function to get progress for a specific repository from active progress list
export function getRepositoryProgressFromActive(
  repositoryId: string, 
  activeProgress: CrawlProgressInfo[]
): CrawlProgressInfo | null {
  return activeProgress.find(progress => progress.repository_id === repositoryId) || null;
}