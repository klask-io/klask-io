import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SearchBar } from '../../components/search/SearchBar';
import { SearchFiltersV3, type SearchFilters } from '../../components/search/SearchFiltersV3';
import { SearchResults } from '../../components/search/SearchResults';
import { usePaginatedSearch, useSearchFilters, useSearchHistory } from '../../hooks/useSearch';
import { getErrorMessage } from '../../lib/api';
import type { SearchResult } from '../../types';
import {
  ClockIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const SearchPageV4: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [currentPage, setCurrentPage] = useState(1);

  const { history, addToHistory, clearHistory } = useSearchHistory();

  // Function to update URL with current search state
  const updateURL = useCallback((searchQuery: string, searchFilters: SearchFilters, page: number = 1) => {
    const params = new URLSearchParams();

    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    if (searchFilters.project) {
      params.set('project', searchFilters.project);
    }
    if (searchFilters.version) {
      params.set('version', searchFilters.version);
    }
    if (searchFilters.extension) {
      params.set('extension', searchFilters.extension);
    }
    if (searchFilters.language) {
      params.set('language', searchFilters.language);
    }
    if (page > 1) {
      params.set('page', page.toString());
    }

    const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newURL);
  }, []);

  // Track if we're initializing to avoid double URL updates
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlQuery = urlParams.get('q') || '';
    const urlProject = urlParams.get('project') || undefined;
    const urlVersion = urlParams.get('version') || undefined;
    const urlExtension = urlParams.get('extension') || undefined;
    const urlLanguage = urlParams.get('language') || undefined;
    const urlPage = parseInt(urlParams.get('page') || '1', 10);

    // Set React state from URL
    setQuery(urlQuery);
    setFilters({
      project: urlProject,
      version: urlVersion,
      extension: urlExtension,
      language: urlLanguage,
    });
    setCurrentPage(urlPage);
    setIsInitializing(false);
  }, [location.search]);

  // Update URL whenever search state changes (only after initialization)
  useEffect(() => {
    if (isInitializing) return;
    updateURL(query, filters, currentPage);
  }, [query, filters, currentPage, updateURL, isInitializing]);

  const {
    data: availableFilters,
    isLoading: filtersLoading,
    error: filtersError,
  } = useSearchFilters();

  const {
    data: searchData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = usePaginatedSearch(query, filters as Record<string, string | undefined>, currentPage, {
    enabled: !!query.trim(),
  });

  const results = searchData?.results || [];
  const totalResults = searchData?.total || 0;
  const pageSize = 20;
  const totalPages = Math.ceil(totalResults / pageSize);

  const handleSearch = useCallback((searchQuery: string) => {
    if (searchQuery !== query) {
      setCurrentPage(1);
    }
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim());
    }
  }, [addToHistory, query]);

  const handleFileClick = useCallback((result: SearchResult) => {
    navigate(`/files/doc/${result.doc_address}`, {
      state: {
        searchQuery: query,
        searchResult: result,
        searchState: {
          initialQuery: query,
          filters: filters,
          page: currentPage
        }
      }
    });
  }, [navigate, query, filters, currentPage]);

  const handleHistoryClick = useCallback((historicalQuery: string) => {
    setQuery(historicalQuery);
    setCurrentPage(1);
    if (historicalQuery.trim()) {
      addToHistory(historicalQuery.trim());
    }

    setTimeout(() => {
      if (refetch) {
        refetch();
      }
    }, 50);
  }, [addToHistory, refetch]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const searchError = isError ? getErrorMessage(error) : null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Filters */}
      <div className="flex-shrink-0 bg-white shadow-sm">
        <SearchFiltersV3
          filters={filters}
          onFiltersChange={handleFiltersChange}
          availableFilters={{
            projects: availableFilters?.projects?.map(p => ({
              value: p.value || p.toString(),
              label: p.value || p.toString(),
              count: p.count || 0,
            })) || [],
            versions: availableFilters?.versions?.map(v => ({
              value: v.value || v.toString(),
              label: v.value || v.toString(),
              count: v.count || 0,
            })) || [],
            extensions: availableFilters?.extensions?.map(e => ({
              value: e.value || e.toString(),
              label: `.${e.value || e.toString()}`,
              count: e.count || 0,
            })) || [],
            languages: [], // Will be derived from extensions in the future
          }}
          isLoading={filtersLoading}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-7 text-gray-900">
                Code Search
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Search through your indexed repositories with powerful filters.
              </p>
            </div>

            {totalResults > 0 && (
              <div className="ml-4 flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-white text-gray-700">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                {totalResults.toLocaleString()} results
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            placeholder="Search functions, classes, variables, comments..."
            isLoading={isLoading || isFetching}
          />

          {/* Search History */}
          {!query && history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Recent Searches</span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 5).map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistoryClick(item)}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <DocumentMagnifyingGlassIcon className="h-3 w-3 mr-1" />
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error State for Filters */}
        {filtersError && (
          <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <DocumentMagnifyingGlassIcon className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Filters Unavailable
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Unable to load search filters. You can still search, but filtering options may be limited.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="flex-1 overflow-hidden">
          <SearchResults
            results={results}
            query={query}
            isLoading={isLoading}
            error={searchError}
            totalResults={totalResults}
            onFileClick={handleFileClick}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            pageSize={pageSize}
          />
        </div>

        {/* Search Tips - shown when no query */}
        {!query.trim() && !isLoading && (
          <div className="mx-6 mb-6 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg p-6 border border-primary-100">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Search Tips
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Basic Search</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Search for function names, class names, variables</li>
                  <li>• Look for specific strings in comments</li>
                  <li>• Find TODO items and FIXME comments</li>
                  <li>• Search across all indexed repositories</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Advanced Features</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Filter by project, version, or file type</li>
                  <li>• Results include syntax highlighting</li>
                  <li>• Click any result to view the full file</li>
                  <li>• Search history is saved locally</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPageV4;