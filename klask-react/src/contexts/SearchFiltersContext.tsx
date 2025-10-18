/**
 * SearchFiltersContext - Manages search filter state with automatic facet count updates
 *
 * This context provides:
 * - Filter state management (selected filters across categories)
 * - Automatic facet fetching when filters change via useFacetsWithFilters hook
 * - Hybrid display strategy: shows dynamic counts when filters change
 * - Merging of static filter lists with dynamic counts for accurate UI display
 */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSearchFilters, useFacetsWithFilters } from '../hooks/useSearch';

export interface SearchFilters {
  project?: string[];
  version?: string[];
  extension?: string[];
  language?: string[];
  repository?: string[];
  [key: string]: string[] | undefined;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface DynamicFilters {
  projects?: Array<{ value: string; count: number }>;
  versions?: Array<{ value: string; count: number }>;
  extensions?: Array<{ value: string; count: number }>;
  repositories?: Array<{ value: string; count: number }>;
}

interface SearchFiltersContextType {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  clearFilters: () => void;
  currentQuery: string;
  setCurrentQuery: (query: string) => void;
  availableFilters: {
    projects: FilterOption[];
    versions: FilterOption[];
    extensions: FilterOption[];
    languages: FilterOption[];
    repositories: FilterOption[];
  };
  isLoading: boolean;
  updateDynamicFilters: (facets: DynamicFilters | null) => void;
}

const SearchFiltersContext = createContext<SearchFiltersContextType | undefined>(undefined);

export const useSearchFiltersContext = () => {
  const context = useContext(SearchFiltersContext);
  if (!context) {
    throw new Error('useSearchFiltersContext must be used within a SearchFiltersProvider');
  }
  return context;
};

export const SearchFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [currentQuery, setCurrentQuery] = useState('');
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilters | null>(null);

  const {
    data: staticFilters,
    isLoading,
  } = useSearchFilters({ enabled: true }); // Only load filters in search context

  // Fetch facets when filters change (automatically triggered when filters have values)
  // Debounce is set to 300ms to prevent excessive API calls during rapid filter selections
  const { data: filterFacets } = useFacetsWithFilters(
    {
      project: filters.project,
      version: filters.version,
      extension: filters.extension,
      repository: filters.repository,
    },
    { enabled: true, staleTime: 60000, debounceMs: 300 }
  );

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const updateDynamicFilters = useCallback((facets: DynamicFilters | null) => {
    setDynamicFilters(facets);
  }, []);

  // Effect: Update dynamicFilters when filter facets are fetched from API
  // This enables real-time facet count updates as filters are changed
  useEffect(() => {
    if (filterFacets) {
      setDynamicFilters(filterFacets);
    }
  }, [filterFacets]);

  /**
   * Merges static filter lists with dynamic facet counts from the API.
   *
   * Strategy:
   * - Static list: Initial comprehensive list of all available filter options
   * - Dynamic list: Real-time facet counts based on currently applied filters
   * - Selected values: Currently active filter selections
   *
   * Behavior:
   * 1. When no dynamic data: Returns static list as fallback
   * 2. When no static data: Returns dynamic list (API response only)
   * 3. When both present: Combines both lists, prioritizing dynamic counts
   * 4. Always includes selected items, even if they have 0 count
   * 5. Filters out items with 0 count that aren't currently selected
   *
   * Use cases:
   * - Shows accurate result counts when filters are applied (via dynamic counts)
   * - Maintains comprehensive option visibility when no filters active (via static list)
   * - Preserves user selections even if temporarily out of current result set
   *
   * @param staticList - Initial comprehensive list from backend (all options)
   * @param dynamicList - Real-time facet counts based on active filters
   * @param selectedValues - Currently selected filter values by the user
   * @returns Merged list with accurate counts and relevant options for current filter state
   */
  const mergeFiltersWithDynamicCounts = (
    staticList: Array<{ value: string; count: number }>,
    dynamicList: Array<{ value: string; count: number }>,
    selectedValues: string[] = []
  ): Array<{ value: string; count: number }> => {
    if (!staticList) return dynamicList || [];
    if (!dynamicList) return staticList;

    // Create a map of dynamic counts for O(1) lookup
    const dynamicMap = new Map(dynamicList.map(item => [item.value, item.count]));

    // Merge static and dynamic lists, keeping selected items even if not in static
    const staticValues = new Set(staticList.map(item => item.value));
    const allItems = [...staticList];

    // Add selected items that are not in static list (handles edge cases)
    selectedValues.forEach(selected => {
      if (!staticValues.has(selected)) {
        const dynamicItem = dynamicList.find(d => d.value === selected);
        if (dynamicItem) {
          allItems.push(dynamicItem);
        } else {
          allItems.push({ value: selected, count: 0 });
        }
      }
    });

    // Update all items with dynamic counts and filter meaningfully
    const result = allItems
      .map(item => ({
        value: item.value,
        count: dynamicMap.get(item.value) || 0
      }))
      // Keep items that either have results OR are currently selected
      .filter(item => item.count > 0 || selectedValues.includes(item.value));

    return result;
  };

  // Smart hybrid strategy:
  // - If no filter selected in a category → show only items with results (dynamic)
  // - If filters selected in a category → show all items (static) with current counts (dynamic)
  const hybridFilters: Record<string, Array<{ value: string; count: number }>> = {
    projects: (filters.project && filters.project.length > 0)
      ? mergeFiltersWithDynamicCounts(
          (staticFilters?.projects as Array<{ value: string; count: number }>) || [],
          (dynamicFilters?.projects as Array<{ value: string; count: number }>) || [],
          filters.project
        )
      : (dynamicFilters?.projects as Array<{ value: string; count: number }>) ||
        (staticFilters?.projects as Array<{ value: string; count: number }>) || [],
    versions: (filters.version && filters.version.length > 0)
      ? mergeFiltersWithDynamicCounts(
          (staticFilters?.versions as Array<{ value: string; count: number }>) || [],
          (dynamicFilters?.versions as Array<{ value: string; count: number }>) || [],
          filters.version
        )
      : (dynamicFilters?.versions as Array<{ value: string; count: number }>) ||
        (staticFilters?.versions as Array<{ value: string; count: number }>) || [],
    extensions: (filters.extension && filters.extension.length > 0)
      ? mergeFiltersWithDynamicCounts(
          (staticFilters?.extensions as Array<{ value: string; count: number }>) || [],
          (dynamicFilters?.extensions as Array<{ value: string; count: number }>) || [],
          filters.extension
        )
      : (dynamicFilters?.extensions as Array<{ value: string; count: number }>) ||
        (staticFilters?.extensions as Array<{ value: string; count: number }>) || [],
    repositories: (filters.repository && filters.repository.length > 0)
      ? mergeFiltersWithDynamicCounts(
          (staticFilters?.repositories as Array<{ value: string; count: number }>) || [],
          (dynamicFilters?.repositories as Array<{ value: string; count: number }>) || [],
          filters.repository
        )
      : (dynamicFilters?.repositories as Array<{ value: string; count: number }>) ||
        (staticFilters?.repositories as Array<{ value: string; count: number }>) || [],
  };

  const availableFiltersList: {
    projects: FilterOption[];
    versions: FilterOption[];
    extensions: FilterOption[];
    repositories: FilterOption[];
    languages: FilterOption[];
  } = {
    projects: (hybridFilters.projects || []).map((p: { value: string; count: number }) => ({
      value: p.value,
      label: p.value,
      count: p.count || 0,
    })),
    versions: (hybridFilters.versions || []).map((v: { value: string; count: number }) => ({
      value: v.value,
      label: v.value,
      count: v.count || 0,
    })),
    extensions: (hybridFilters.extensions || []).map((e: { value: string; count: number }) => ({
      value: e.value,
      label: `.${e.value}`,
      count: e.count || 0,
    })),
    repositories: (hybridFilters.repositories || []).map((r: { value: string; count: number }) => ({
      value: r.value,
      label: r.value,
      count: r.count || 0,
    })),
    languages: [], // Will be derived from extensions in the future
  };

  const value: SearchFiltersContextType = {
    filters,
    setFilters,
    clearFilters,
    currentQuery,
    setCurrentQuery,
    availableFilters: availableFiltersList,
    isLoading,
    updateDynamicFilters,
  };

  return (
    <SearchFiltersContext.Provider value={value}>
      {children}
    </SearchFiltersContext.Provider>
  );
};