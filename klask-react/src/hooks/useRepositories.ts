import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getErrorMessage } from '../lib/api';
import type { Repository, CreateRepositoryRequest } from '../types';

// Get all repositories
export const useRepositories = () => {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: () => apiClient.getRepositories(),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};

// Get single repository
export const useRepository = (id: string) => {
  return useQuery({
    queryKey: ['repositories', id],
    queryFn: () => apiClient.getRepository(id),
    enabled: !!id,
    staleTime: 30000,
    retry: 2,
  });
};

// Create repository mutation
export const useCreateRepository = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateRepositoryRequest) => apiClient.createRepository(data),
    onSuccess: () => {
      // Invalidate and refetch repositories list
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
    onError: (error) => {
      console.error('Failed to create repository:', getErrorMessage(error));
    },
  });
};

// Update repository mutation
export const useUpdateRepository = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRepositoryRequest> }) => 
      apiClient.updateRepository(id, data),
    onSuccess: (updatedRepo) => {
      // Update the specific repository in cache
      queryClient.setQueryData(['repositories', updatedRepo.id], updatedRepo);
      
      // Update the repository in the list
      queryClient.setQueryData(['repositories'], (old: Repository[] | undefined) => {
        if (!old) return [updatedRepo];
        return old.map(repo => repo.id === updatedRepo.id ? updatedRepo : repo);
      });
    },
    onError: (error) => {
      console.error('Failed to update repository:', getErrorMessage(error));
    },
  });
};

// Delete repository mutation
export const useDeleteRepository = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteRepository(id),
    onSuccess: (_, deletedId) => {
      // Remove from repositories list
      queryClient.setQueryData(['repositories'], (old: Repository[] | undefined) => {
        if (!old) return [];
        return old.filter(repo => repo.id !== deletedId);
      });
      
      // Remove individual repository cache
      queryClient.removeQueries({ queryKey: ['repositories', deletedId] });
    },
    onError: (error) => {
      console.error('Failed to delete repository:', getErrorMessage(error));
    },
  });
};

// Crawl repository mutation
export const useCrawlRepository = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.crawlRepository(id),
    onSuccess: (_, repositoryId) => {
      // Refetch the specific repository to get updated lastCrawled timestamp
      queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      // Force immediate refetch of active progress to switch polling interval
      queryClient.refetchQueries({ queryKey: ['repositories', 'progress', 'active'] });
    },
    onError: (error: any) => {
      if (error.status === 409) {
        console.warn('Repository is already being crawled');
      } else {
        console.error('Failed to crawl repository:', getErrorMessage(error));
      }
    },
  });
};

// Stop crawl repository mutation
export const useStopCrawl = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.stopCrawlRepository(id),
    onSuccess: (_, repositoryId) => {
      // Invalidate progress queries to reflect the stopped status
      queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId, 'progress'] });
      queryClient.invalidateQueries({ queryKey: ['repositories', 'progress', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId] });
    },
    onError: (error: any) => {
      if (error.status === 404) {
        console.warn('No active crawl found for repository');
      } else {
        console.error('Failed to stop crawl:', getErrorMessage(error));
      }
    },
  });
};

// Repository statistics (if needed)
export const useRepositoryStats = () => {
  const { data: repositories } = useRepositories();
  
  const stats = React.useMemo(() => {
    if (!repositories) return null;
    
    const total = repositories.length;
    const enabled = repositories.filter(repo => repo.enabled).length;
    const crawled = repositories.filter(repo => repo.lastCrawled).length;
    const gitRepos = repositories.filter(repo => repo.repositoryType === 'Git').length;
    const gitlabRepos = repositories.filter(repo => repo.repositoryType === 'GitLab').length;
    const filesystemRepos = repositories.filter(repo => repo.repositoryType === 'FileSystem').length;
    
    return {
      total,
      enabled,
      disabled: total - enabled,
      crawled,
      notCrawled: total - crawled,
      byType: {
        git: gitRepos,
        gitlab: gitlabRepos,
        filesystem: filesystemRepos,
      },
    };
  }, [repositories]);
  
  return stats;
};

// Bulk operations
export const useBulkRepositoryOperations = () => {
  const queryClient = useQueryClient();
  
  const bulkEnable = useMutation({
    mutationFn: async (repositoryIds: string[]) => {
      const promises = repositoryIds.map(id => 
        apiClient.updateRepository(id, { enabled: true })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
  
  const bulkDisable = useMutation({
    mutationFn: async (repositoryIds: string[]) => {
      const promises = repositoryIds.map(id => 
        apiClient.updateRepository(id, { enabled: false })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
  
  const bulkCrawl = useMutation({
    mutationFn: async (repositoryIds: string[]) => {
      const results = await Promise.allSettled(
        repositoryIds.map(async id => {
          try {
            return await apiClient.crawlRepository(id);
          } catch (error: any) {
            // If the error is a conflict (409), it means the repository is already being crawled
            if (error.status === 409) {
              throw new Error(`Repository is already being crawled`);
            }
            throw error;
          }
        })
      );
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      const alreadyCrawling = results.filter(result => 
        result.status === 'rejected' && 
        result.reason?.message?.includes('already being crawled')
      ).length;
      
      return {
        successful,
        failed,
        alreadyCrawling,
        total: repositoryIds.length
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.invalidateQueries({ queryKey: ['repositories', 'progress', 'active'] });
    },
  });
  
  const bulkDelete = useMutation({
    mutationFn: async (repositoryIds: string[]) => {
      const promises = repositoryIds.map(id => apiClient.deleteRepository(id));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
  
  return {
    bulkEnable,
    bulkDisable,
    bulkCrawl,
    bulkDelete,
  };
};

import React from 'react';
import type { CrawlProgressInfo } from '../types';
import { useActiveProgress as useActiveProgressBase } from '../hooks/useProgress';

// Wrapper to match React Query's expected return format
export const useActiveProgress = () => {
  const { activeProgress, isLoading, error, refreshActiveProgress } = useActiveProgressBase();
  
  return {
    data: activeProgress,
    isLoading,
    error,
    refetch: refreshActiveProgress,
  };
};

// Hook to get progress for a specific repository
export const useRepositoryProgress = (repositoryId: string) => {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'progress'],
    queryFn: () => apiClient.getRepositoryProgress(repositoryId),
    enabled: !!repositoryId,
    refetchInterval: 1000, // Refetch every 1 second
    staleTime: 1000, // Consider data stale after 1 second
    retry: 2,
  });
};