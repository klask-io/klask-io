import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { File, SearchQuery, SearchResponse, PaginatedResponse } from '../types';

// File API operations
export const useFiles = (params?: { 
  project?: string; 
  path?: string; 
  page?: number; 
  size?: number;
}) => {
  return useQuery({
    queryKey: ['files', params],
    queryFn: async (): Promise<PaginatedResponse<File>> => {
      const searchParams = new URLSearchParams();
      
      if (params?.project) searchParams.append('project', params.project);
      if (params?.path) searchParams.append('path', params.path);
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.size) searchParams.append('size', params.size.toString());
      
      const response = await api.get(`/files?${searchParams.toString()}`);
      return response.data;
    },
    enabled: !!params?.project,
  });
};

export const useFile = (id: string) => {
  return useQuery({
    queryKey: ['files', id],
    queryFn: async (): Promise<File> => {
      const response = await api.get(`/files/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useFileContent = (id: string) => {
  return useQuery({
    queryKey: ['files', id, 'content'],
    queryFn: async (): Promise<string> => {
      const response = await api.get(`/files/${id}/content`);
      return response.data;
    },
    enabled: !!id,
  });
};

// File tree/directory operations
export const useFileTree = (project: string, path?: string) => {
  return useQuery({
    queryKey: ['file-tree', project, path],
    queryFn: async (): Promise<FileTreeNode[]> => {
      const searchParams = new URLSearchParams();
      searchParams.append('project', project);
      if (path) searchParams.append('path', path);
      
      const response = await api.get(`/files/tree?${searchParams.toString()}`);
      return response.data;
    },
    enabled: !!project,
  });
};

// Search operations
export const useFileSearch = () => {
  return useMutation({
    mutationFn: async (query: SearchQuery): Promise<SearchResponse> => {
      const response = await api.post('/search', query);
      return response.data;
    },
  });
};

// File statistics
export const useFileStats = (project?: string) => {
  return useQuery({
    queryKey: ['file-stats', project],
    queryFn: async (): Promise<FileStats> => {
      const searchParams = new URLSearchParams();
      if (project) searchParams.append('project', project);
      
      const response = await api.get(`/files/stats?${searchParams.toString()}`);
      return response.data;
    },
  });
};

// Types for file tree and statistics
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  lastModified?: string;
  children?: FileTreeNode[];
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byExtension: Record<string, { count: number; size: number }>;
  byProject: Record<string, { count: number; size: number }>;
  largestFiles: Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    project: string;
  }>;
}

// Utility hooks
export const useRecentFiles = (limit = 10) => {
  return useQuery({
    queryKey: ['files', 'recent', limit],
    queryFn: async (): Promise<File[]> => {
      const response = await api.get(`/files/recent?limit=${limit}`);
      return response.data;
    },
  });
};

export const usePopularExtensions = () => {
  return useQuery({
    queryKey: ['files', 'extensions'],
    queryFn: async (): Promise<Array<{ extension: string; count: number }>> => {
      const response = await api.get('/files/extensions');
      return response.data;
    },
  });
};

// File operations hooks return object
export const useFileOperations = () => {
  const queryClient = useQueryClient();

  const invalidateFiles = () => {
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['file-tree'] });
    queryClient.invalidateQueries({ queryKey: ['file-stats'] });
  };

  return {
    invalidateFiles,
  };
};