import React from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { SearchQuery, SearchResponse } from '../types';

export interface UseSearchOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
}

export const useSearch = (
  query: SearchQuery,
  options: UseSearchOptions = {}
) => {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 30000, // 30 seconds
  } = options;

  return useQuery({
    queryKey: ['search', query],
    queryFn: () => apiClient.search(query),
    enabled: enabled && !!query.query?.trim(),
    refetchOnWindowFocus,
    staleTime,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 3;
    },
  });
};

export const useInfiniteSearch = (
  baseQuery: Omit<SearchQuery, 'maxResults'>,
  options: UseSearchOptions = {}
) => {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 30000,
  } = options;

  const pageSize = 20;

  return useInfiniteQuery({
    queryKey: ['search', 'infinite', baseQuery],
    queryFn: ({ pageParam = 0 }) => {
      const query: SearchQuery = {
        ...baseQuery,
        maxResults: pageSize,
        offset: pageParam * pageSize,
      };
      return apiClient.search(query);
    },
    enabled: enabled && !!baseQuery.query?.trim(),
    refetchOnWindowFocus,
    staleTime,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, page) => sum + page.results.length, 0);
      return totalLoaded < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 3;
    },
  });
};

export const useSearchFilters = () => {
  return useQuery({
    queryKey: ['search', 'filters'],
    queryFn: async () => {
      const filters = await apiClient.getSearchFilters();
      // Transform the response to include both value and count for facets
      return {
        projects: filters.projects?.map((p: any) => ({
          value: p.value || p,
          label: p.value || p,
          count: p.count || 0,
        })) || [],
        versions: filters.versions?.map((v: any) => ({
          value: v.value || v,
          label: v.value || v,
          count: v.count || 0,
        })) || [],
        extensions: filters.extensions?.map((e: any) => ({
          value: e.value || e,
          label: e.value || e,
          count: e.count || 0,
        })) || [],
        languages: [], // TODO: Derive from extensions or add separate field
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
};

// Multi-select search hook for new filters
export const useMultiSelectSearch = (
  query: string,
  filters: { [key: string]: string[] | undefined },
  currentPage: number = 1,
  options: UseSearchOptions = {}
) => {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 30000,
  } = options;

  const pageSize = 20;
  const offset = (currentPage - 1) * pageSize;

  return useQuery({
    queryKey: ['search', 'multiselect', query, filters, currentPage],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (query.trim()) {
        searchParams.set('q', query.trim());
      }
      
      // Handle multi-select filters
      if (filters.projects && filters.projects.length > 0) {
        filters.projects.forEach(project => {
          searchParams.append('projects', project);
        });
      }
      
      if (filters.versions && filters.versions.length > 0) {
        filters.versions.forEach(version => {
          searchParams.append('versions', version);
        });
      }
      
      if (filters.extensions && filters.extensions.length > 0) {
        filters.extensions.forEach(extension => {
          searchParams.append('extensions', extension);
        });
      }
      
      searchParams.set('limit', pageSize.toString());
      searchParams.set('page', currentPage.toString());
      searchParams.set('include_facets', 'true');
      
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!query.trim(),
    refetchOnWindowFocus,
    staleTime,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 3;
    },
  });
};

// Advanced search hook with debouncing and intelligent caching
export const useAdvancedSearch = (
  query: string,
  filters: Record<string, string | undefined> = {},
  options: UseSearchOptions & { debounceMs?: number } = {}
) => {
  const { debounceMs = 300, ...queryOptions } = options;
  
  // Create search query object
  const searchQuery: SearchQuery = {
    query: query.trim(),
    project: filters.project,
    version: filters.version,
    extension: filters.extension,
    maxResults: 50,
  };

  // Use infinite search for better performance with large result sets
  const infiniteQuery = useInfiniteSearch(searchQuery, queryOptions);

  // Flatten results for easier consumption
  const results = React.useMemo(() => {
    if (!infiniteQuery.data) return [];
    return infiniteQuery.data.pages.flatMap(page => page.results);
  }, [infiniteQuery.data]);

  const totalResults = infiniteQuery.data?.pages[0]?.total ?? 0;
  const facets = infiniteQuery.data?.pages[0]?.facets ?? undefined;
  const hasNextPage = infiniteQuery.hasNextPage;
  const isFetchingNextPage = infiniteQuery.isFetchingNextPage;

  return {
    results,
    totalResults,
    facets,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    refetch: infiniteQuery.refetch,
  };
};

// Paginated search hook with numbered pages
export const usePaginatedSearch = (
  query: string,
  filters: Record<string, string | undefined> = {},
  page: number = 1,
  options: UseSearchOptions = {}
) => {
  const pageSize = 20;
  
  // Create search query object
  const searchQuery: SearchQuery = {
    query: query.trim(),
    project: filters.project,
    version: filters.version,
    extension: filters.extension,
    maxResults: pageSize,
    offset: (page - 1) * pageSize,
  };

  return useQuery({
    queryKey: ['search', 'paginated', searchQuery, page],
    queryFn: () => apiClient.search(searchQuery),
    enabled: options.enabled !== false && !!query.trim(),
    refetchOnWindowFocus: options.refetchOnWindowFocus || false,
    staleTime: options.staleTime || 30000,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 3;
    },
  });
};

// Real-time search suggestions hook
export const useSearchSuggestions = (
  query: string,
  options: { enabled?: boolean; limit?: number } = {}
) => {
  const { enabled = true, limit = 5 } = options;

  return useQuery({
    queryKey: ['search', 'suggestions', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      
      // For now, return empty suggestions
      // In the future, this could call a dedicated suggestions endpoint
      return [];
    },
    enabled: enabled && query.length >= 2,
    staleTime: 60000, // 1 minute
    retry: false,
  });
};

// Search history hook (local storage based)
export const useSearchHistory = () => {
  const [history, setHistory] = React.useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('klask-search-history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addToHistory = React.useCallback((query: string) => {
    if (!query.trim()) return;
    
    setHistory(prev => {
      const filtered = prev.filter(item => item !== query);
      const newHistory = [query, ...filtered].slice(0, 10); // Keep last 10
      
      try {
        localStorage.setItem('klask-search-history', JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }
      
      return newHistory;
    });
  }, []);

  const clearHistory = React.useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem('klask-search-history');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    history,
    addToHistory,
    clearHistory,
  };
};

// Hook for FilesPage - simple search results
export const useSearchResults = (
  query: string,
  options: {
    limit?: number;
    offset?: number;
    extension?: string;
    project?: string;
  } = {}
) => {
  const { limit = 50, offset = 0, extension, project } = options;

  const searchQuery: SearchQuery = {
    query: query || '*', // Default to wildcard for all files
    maxResults: limit,
    offset,
    extension,
    project,
  };

  return useQuery({
    queryKey: ['search', 'results', searchQuery],
    queryFn: () => apiClient.search(searchQuery),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};