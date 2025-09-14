import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SearchBar } from '../../components/search/SearchBar';
import { SearchFiltersComponent, type SearchFilters } from '../../components/search/SearchFilters';
import { SearchResults } from '../../components/search/SearchResults';
import { useAdvancedSearch, useSearchFilters, useSearchHistory } from '../../hooks/useSearch';
import { getErrorMessage } from '../../lib/api';
import type { SearchResult } from '../../types';
import { 
  ClockIcon, 
  Cog6ToothIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon 
} from '@heroicons/react/24/outline';

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { history, addToHistory, clearHistory } = useSearchHistory();
  
  // Initialize query from location state (when returning from file view)
  useEffect(() => {
    const initialQuery = location.state?.initialQuery as string;
    const searchFilters = location.state?.filters as SearchFilters;
    const advanced = location.state?.showAdvanced as boolean;
    
    if (initialQuery) {
      setQuery(initialQuery);
    }
    if (searchFilters) {
      setFilters(searchFilters);
    }
    if (advanced !== undefined) {
      setShowAdvanced(advanced);
    }
    
    // Clear the location state to avoid re-applying on refresh
    if (initialQuery || searchFilters || advanced !== undefined) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state]);
  
  const {
    data: availableFilters,
    isLoading: filtersLoading,
    error: filtersError,
  } = useSearchFilters();

  const {
    results,
    totalResults,
    isLoading,
    isFetching,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useAdvancedSearch(query, filters as Record<string, string | undefined>, {
    enabled: !!query.trim(),
  });


  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim());
    }
  }, [addToHistory]);

  const handleFileClick = useCallback((result: SearchResult) => {
    navigate(`/files/doc/${result.doc_address}`, {
      state: { 
        searchQuery: query,
        searchResult: result,
        // Preserve search state for return navigation
        searchState: {
          initialQuery: query,
          filters: filters,
          showAdvanced: showAdvanced
        }
      }
    });
  }, [navigate, query, filters, showAdvanced]);

  const handleHistoryClick = useCallback((historicalQuery: string) => {
    // Set query immediately and add to history
    setQuery(historicalQuery);
    if (historicalQuery.trim()) {
      addToHistory(historicalQuery.trim());
    }
    
    // Force a manual refetch of the search query to bypass any debounce issues
    setTimeout(() => {
      if (refetch) {
        refetch();
      }
    }, 50); // Give time for setQuery to take effect
  }, [addToHistory, refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const searchError = isError ? getErrorMessage(error) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Code Search
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Search through your indexed repositories with powerful filters and real-time results.
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              showAdvanced
                ? 'border-primary-300 text-blue-700 bg-blue-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <Cog6ToothIcon className="h-4 w-4 mr-2" />
            Advanced
          </button>
          
          {totalResults > 0 && (
            <div className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-white text-gray-700">
              <ChartBarIcon className="h-4 w-4 mr-2" />
              {totalResults.toLocaleString()} results
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
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

      {/* Advanced Filters */}
      {showAdvanced && (
        <SearchFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          availableFilters={{
            projects: availableFilters?.projects || [],
            versions: availableFilters?.versions || [],
            extensions: availableFilters?.extensions || [],
            languages: [], // Will be derived from extensions
          }}
          isLoading={filtersLoading}
        />
      )}

      {/* Error State for Filters */}
      {filtersError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
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
      <SearchResults
        results={results}
        query={query}
        isLoading={isLoading}
        error={searchError}
        totalResults={totalResults}
        onFileClick={handleFileClick}
        onLoadMore={handleLoadMore}
        hasNextPage={hasNextPage}
      />

      {/* Search Tips - shown when no query */}
      {!query.trim() && !isLoading && (
        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg p-6 border border-primary-100">
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
  );
};

export default SearchPage;