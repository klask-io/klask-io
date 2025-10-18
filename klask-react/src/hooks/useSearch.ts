import React from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  SearchQuery,
  FacetResponseItem,
  FacetsApiResponse,
} from '../types';

export interface UseSearchOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  debounceMs?: number;
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

export const useSearchFilters = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['search', 'filters'],
    queryFn: async () => {
      const filters = await apiClient.getSearchFilters();
      // Transform the response to include both value and count for facets
      // @ts-ignore - repositories field will be added by backend
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
        // @ts-expect-error - repositories field will be added by backend
        repositories: filters.repositories?.map((r: any) => ({
          value: r.value || r,
          label: r.value || r,
          count: r.count || 0,
        })) || [],
        languages: [], // TODO: Derive from extensions or add separate field
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    enabled: options?.enabled ?? false, // Disabled by default to avoid slow queries on every page load
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
      
      // Handle multi-select filters - join with commas
      if (filters.project && filters.project.length > 0) {
        searchParams.set('projects', filters.project.join(','));
      }

      if (filters.version && filters.version.length > 0) {
        searchParams.set('versions', filters.version.join(','));
      }

      if (filters.extension && filters.extension.length > 0) {
        searchParams.set('extensions', filters.extension.join(','));
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

/**
 * Normalize facet API response to a consistent format.
 * Returns empty arrays for missing facet fields to ensure consistent structure.
 *
 * @param data - Raw API response data
 * @returns Normalized FacetsApiResponse with proper types, always includes all fields
 */
const normalizeFacetsResponse = (data: unknown): FacetsApiResponse => {
  if (!data || typeof data !== 'object') {
    return {
      projects: [],
      versions: [],
      extensions: [],
      repositories: [],
    };
  }

  const response = data as Record<string, unknown>;

  // Type guard and normalization function for facet arrays
  const normalizeFacetArray = (items: unknown): FacetResponseItem[] => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const facet = item as Record<string, unknown>;
          return {
            value: String(facet.value || ''),
            count: Number(facet.count) || 0,
          };
        }
        return null;
      })
      .filter((item): item is FacetResponseItem => item !== null);
  };

  return {
    projects: normalizeFacetArray(response.projects),
    versions: normalizeFacetArray(response.versions),
    extensions: normalizeFacetArray(response.extensions),
    repositories: normalizeFacetArray(response.repositories),
  };
};

/**
 * Fetch facet counts based on pre-selected filters without requiring a search query.
 * Useful for populating filter dropdowns with accurate counts when filters change.
 *
 * Calls the dedicated /api/search/facets endpoint to get facet aggregations
 * across documents matching the selected filters.
 *
 * Features:
 * - Debounces filter changes to prevent excessive API calls
 * - Strongly typed facet responses using FacetsApiResponse interface
 * - Only queries when filters are present
 * - Efficient retry strategy with proper error handling
 *
 * @param filters - Object containing arrays of selected filter values
 * @param options - Configuration options for the hook (enabled, staleTime, debounceMs)
 * @returns Query result with normalized facets data and status
 *
 * Example:
 * const { data: facets, isLoading, error } = useFacetsWithFilters({
 *   project: ['react', 'vue'],
 *   version: ['1.0', '2.0']
 * }, { debounceMs: 300 });
 */
export const useFacetsWithFilters = (
  filters: {
    project?: string[];
    version?: string[];
    extension?: string[];
    repository?: string[];
  } = {},
  options: UseSearchOptions = {}
) => {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 60000, // 1 minute - facets are relatively stable
    debounceMs = 300, // Default 300ms debounce
  } = options;

  // State to manage debounced filters
  const [debouncedFilters, setDebouncedFilters] = React.useState(filters);

  // Debounce effect: wait before updating filters
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [filters, debounceMs]);

  // Serialize filters for consistent query key generation
  // Create sorted copies to avoid mutating original arrays and ensure stable references
  const filterKey = React.useMemo(() => {
    return {
      project: [...(debouncedFilters.project || [])].sort(),
      version: [...(debouncedFilters.version || [])].sort(),
      extension: [...(debouncedFilters.extension || [])].sort(),
      repository: [...(debouncedFilters.repository || [])].sort(),
    };
  }, [debouncedFilters]);

  // Check if any filters are selected
  const hasActiveFilters = Object.values(filterKey).some((arr) => arr.length > 0);

  return useQuery({
    // Include filter values in query key for automatic deduplication by React Query
    queryKey: ['search', 'facets', filterKey],
    queryFn: async (): Promise<FacetsApiResponse> => {
      const searchParams = new URLSearchParams();

      // Add filters as comma-separated query parameters
      if (filterKey.project.length > 0) {
        searchParams.set('projects', filterKey.project.join(','));
      }

      if (filterKey.version.length > 0) {
        searchParams.set('versions', filterKey.version.join(','));
      }

      if (filterKey.extension.length > 0) {
        searchParams.set('extensions', filterKey.extension.join(','));
      }

      if (filterKey.repository.length > 0) {
        searchParams.set('repositories', filterKey.repository.join(','));
      }

      // Call dedicated facets endpoint
      const response = await fetch(`/api/search/facets?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error(`Facets fetch failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Return normalized facets with proper types
      return normalizeFacetsResponse(data);
    },
    // Only query when enabled and filters are present
    enabled: enabled && hasActiveFilters,
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
      return failureCount < 2;
    },
  });
};