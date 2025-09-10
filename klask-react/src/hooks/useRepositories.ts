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
    },
    onError: (error) => {
      console.error('Failed to crawl repository:', getErrorMessage(error));
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
      const promises = repositoryIds.map(id => apiClient.crawlRepository(id));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
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