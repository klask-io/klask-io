import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSearchFilters } from '../hooks/useSearch';

export interface SearchFilters {
  project?: string[];
  version?: string[];
  extension?: string[];
  language?: string[];
  [key: string]: string[] | undefined;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
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
  };
  isLoading: boolean;
  updateDynamicFilters: (facets: any) => void;
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
  const [dynamicFilters, setDynamicFilters] = useState<any>(null);

  const {
    data: staticFilters,
    isLoading,
  } = useSearchFilters();

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const updateDynamicFilters = useCallback((facets: any) => {
    setDynamicFilters(facets);
  }, []);

  // Helper function to merge static options with dynamic counts
  const mergeFiltersWithDynamicCounts = (staticList: any[], dynamicList: any[]) => {
    if (!staticList) return dynamicList || [];
    if (!dynamicList) return staticList;

    // Create a map of dynamic counts
    const dynamicMap = new Map(dynamicList.map(item => [item.value, item.count]));

    // Update static list with dynamic counts, filter out items with 0 count
    return staticList
      .map(item => ({
        ...item,
        count: dynamicMap.get(item.value) || 0
      }))
      .filter(item => item.count > 0); // Only show items that have results
  };

  // Smart hybrid strategy:
  // - If no filter selected in a category → show only items with results (dynamic)
  // - If filters selected in a category → show all items (static) with current counts (dynamic)
  const hybridFilters = {
    projects: (filters.project && filters.project.length > 0)
      ? mergeFiltersWithDynamicCounts(staticFilters?.projects || [], dynamicFilters?.projects || [])
      : dynamicFilters?.projects || staticFilters?.projects || [],
    versions: (filters.version && filters.version.length > 0)
      ? mergeFiltersWithDynamicCounts(staticFilters?.versions || [], dynamicFilters?.versions || [])
      : dynamicFilters?.versions || staticFilters?.versions || [],
    extensions: (filters.extension && filters.extension.length > 0)
      ? mergeFiltersWithDynamicCounts(staticFilters?.extensions || [], dynamicFilters?.extensions || [])
      : dynamicFilters?.extensions || staticFilters?.extensions || [],
  };

  const value: SearchFiltersContextType = {
    filters,
    setFilters,
    clearFilters,
    currentQuery,
    setCurrentQuery,
    availableFilters: {
      projects: (hybridFilters.projects || []).map((p: any) => ({
        value: p.value || p.toString(),
        label: p.value || p.toString(),
        count: p.count || 0,
      })),
      versions: (hybridFilters.versions || []).map((v: any) => ({
        value: v.value || v.toString(),
        label: v.value || v.toString(),
        count: v.count || 0,
      })),
      extensions: (hybridFilters.extensions || []).map((e: any) => ({
        value: e.value || e.toString(),
        label: `.${e.value || e.toString()}`,
        count: e.count || 0,
      })),
      languages: [], // Will be derived from extensions in the future
    },
    isLoading,
    updateDynamicFilters,
  };

  return (
    <SearchFiltersContext.Provider value={value}>
      {children}
    </SearchFiltersContext.Provider>
  );
};