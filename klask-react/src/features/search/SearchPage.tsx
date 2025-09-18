import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SearchBar } from '../../components/search/SearchBar';
import { SearchFiltersComponent, type SearchFilters } from '../../components/search/SearchFilters';
import { SearchResults } from '../../components/search/SearchResults';
import { usePaginatedSearch, useSearchFilters, useSearchHistory } from '../../hooks/useSearch';
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
  const [currentPage, setCurrentPage] = useState(1);
  
  const { history, addToHistory, clearHistory } = useSearchHistory();
  
  // Function to update URL with current search state
  const updateURL = useCallback((searchQuery: string, searchFilters: SearchFilters, advanced: boolean, page: number = 1) => {
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
    if (advanced) {
      params.set('advanced', 'true');
    }
    if (page > 1) {
      params.set('page', page.toString());
    }
    
    const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newURL);
  }, []);
  
  // Track if we're initializing to avoid double URL updates
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Initialize from URL parameters and location state
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlQuery = urlParams.get('q');
    const urlProject = urlParams.get('project');
    const urlVersion = urlParams.get('version');
    const urlExtension = urlParams.get('extension');
    const urlAdvanced = urlParams.get('advanced') === 'true';
    const urlPage = parseInt(urlParams.get('page') || '1', 10);
    
    // Priority: location.state (from navigation) > URL params
    // The state can be the searchState object itself (when coming back from FileDetailPage)
    const stateQuery = location.state?.initialQuery as string;
    const stateFilters = location.state?.filters as SearchFilters;
    const stateAdvanced = location.state?.showAdvanced as boolean;
    const statePage = location.state?.page as number | undefined;
    
    
    // Check if we're coming from navigation with state
    const hasNavigationState = !!(stateQuery || stateFilters || stateAdvanced !== undefined || statePage !== undefined);
    
    // Priority: navigation state > URL params
    const finalQuery = stateQuery || urlQuery || '';
    const finalFilters: SearchFilters = {
      project: stateFilters?.project || urlProject || undefined,
      version: stateFilters?.version || urlVersion || undefined,
      extension: stateFilters?.extension || urlExtension || undefined,
    };
    const finalAdvanced = stateAdvanced !== undefined ? stateAdvanced : urlAdvanced;
    const finalPage = statePage || urlPage;
    
    // Update state in a batch to avoid multiple renders
    if (hasNavigationState) {
      // Direct URL update without triggering effects
      const params = new URLSearchParams();
      if (finalQuery.trim()) params.set('q', finalQuery.trim());
      if (finalFilters.project) params.set('project', finalFilters.project);
      if (finalFilters.version) params.set('version', finalFilters.version);
      if (finalFilters.extension) params.set('extension', finalFilters.extension);
      if (finalAdvanced) params.set('advanced', 'true');
      if (finalPage > 1) params.set('page', finalPage.toString());
      
      const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState(null, '', newURL);
    }
    
    // Set React state
    setQuery(finalQuery);
    setFilters(finalFilters);
    setShowAdvanced(finalAdvanced);
    setCurrentPage(finalPage);
    setIsInitializing(false);
  }, [location.state, location.search]);
  
  // Update URL whenever search state changes (only after initialization and not from navigation)
  useEffect(() => {
    if (isInitializing) return;
    // Don't update URL if we have navigation state (coming from file detail page)
    if (location.state) return;
    updateURL(query, filters, showAdvanced, currentPage);
  }, [query, filters, showAdvanced, currentPage, updateURL, isInitializing, location.state]);
  
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
    setQuery(searchQuery);
    setCurrentPage(1); // Reset to first page on new search
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim());
    }
    // URL will be updated by the useEffect automatically
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
          showAdvanced: showAdvanced,
          page: currentPage
        }
      }
    });
  }, [navigate, query, filters, showAdvanced, currentPage]);

  const handleHistoryClick = useCallback((historicalQuery: string) => {
    // Set query immediately and add to history
    setQuery(historicalQuery);
    setCurrentPage(1); // Reset to first page
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

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

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
          onFiltersChange={handleFiltersChange}
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
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        pageSize={pageSize}
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