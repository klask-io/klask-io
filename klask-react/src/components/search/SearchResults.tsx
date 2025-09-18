import React from 'react';
import { SearchResult } from './SearchResult';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Pagination } from '../ui/Pagination';
import { 
  MagnifyingGlassIcon, 
  ExclamationTriangleIcon,
  DocumentMagnifyingGlassIcon 
} from '@heroicons/react/24/outline';
import type { SearchResult as SearchResultType } from '../../types';

interface SearchResultsProps {
  results: SearchResultType[];
  query: string;
  isLoading: boolean;
  error: string | null;
  totalResults: number;
  onFileClick: (result: SearchResultType) => void;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  // Legacy Load More props (optional)
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  className?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  isLoading,
  error,
  totalResults,
  onFileClick,
  // Pagination props
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 20,
  // Legacy Load More props
  onLoadMore,
  hasNextPage = false,
  className = '',
}) => {
  const usePagination = currentPage !== undefined && totalPages !== undefined && onPageChange !== undefined;

  // Empty state when no query
  if (!query.trim() && !isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Search your codebase
          </h3>
          <p className="text-gray-500 text-center max-w-md">
            Enter a search term to find files, functions, classes, and content across 
            your repositories. Use filters to narrow down your results.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">function</kbd>
              <span>Search for function definitions</span>
            </div>
            <div className="flex items-center space-x-2">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">class MyClass</kbd>
              <span>Find class declarations</span>
            </div>
            <div className="flex items-center space-x-2">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">TODO</kbd>
              <span>Search in comments and strings</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 ${className}`}>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">
            Search Error
          </h3>
          <p className="text-red-600 text-center max-w-md mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && results.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <LoadingSpinner size="lg" className="mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Searching...
          </h3>
          <p className="text-gray-500 text-center">
            Looking for "{query}" in your codebase
          </p>
        </div>
      </div>
    );
  }

  // No results state
  if (!isLoading && results.length === 0 && query.trim()) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <DocumentMagnifyingGlassIcon className="h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No results found
          </h3>
          <p className="text-gray-500 text-center max-w-md mb-4">
            No matches found for "{query}". Try adjusting your search terms or filters.
          </p>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Check your spelling</p>
            <p>• Try broader search terms</p>
            <p>• Remove or adjust filters</p>
            <p>• Make sure repositories are indexed</p>
          </div>
        </div>
      </div>
    );
  }

  // Results display
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Results Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Search Results
            </h3>
            <p className="text-sm text-gray-500">
              {isLoading ? (
                <>
                  Found {results.length} results so far for "{query}"
                  <LoadingSpinner size="sm" className="ml-2 inline" />
                </>
              ) : (
                <>
                  {totalResults.toLocaleString()} {totalResults === 1 ? 'result' : 'results'} for "{query}"
                </>
              )}
            </p>
          </div>
          
          {results.length > 0 && !usePagination && (
            <div className="text-sm text-gray-500">
              Showing {results.length} of {totalResults}
            </div>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4 p-6">
        {results.map((result, index) => (
          <SearchResult
            key={`${result.file_id}-${index}`}
            result={result}
            query={query}
            onFileClick={onFileClick}
          />
        ))}
        
        {/* Load More Indicator (Legacy) */}
        {!usePagination && hasNextPage && (
          <div className="flex items-center justify-center py-4">
            <LoadingSpinner size="md" />
            <span className="ml-2 text-gray-500">Loading more results...</span>
          </div>
        )}
      </div>

      {/* Pagination */}
      {usePagination && totalPages! > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <Pagination
            currentPage={currentPage!}
            totalPages={totalPages!}
            onPageChange={onPageChange!}
            totalResults={totalResults}
            pageSize={pageSize}
          />
        </div>
      )}

      {/* Load More Button (Legacy) */}
      {!usePagination && hasNextPage && !isLoading && (
        <div className="px-6 py-4 border-t border-gray-200 text-center">
          <button
            onClick={onLoadMore}
            className="btn-secondary"
          >
            Load More Results
          </button>
        </div>
      )}
    </div>
  );
};