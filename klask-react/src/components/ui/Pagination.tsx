import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalResults?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalResults,
  pageSize = 20,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  // Calculate the range of pages to show
  const getVisiblePages = (): number[] => {
    const delta = 2; // Number of pages to show on each side of current page
    const rangeStart = Math.max(1, currentPage - delta);
    const rangeEnd = Math.min(totalPages, currentPage + delta);
    
    const pages: number[] = [];
    
    // Always include first page
    if (rangeStart > 1) {
      pages.push(1);
      if (rangeStart > 2) {
        pages.push(-1); // Ellipsis marker
      }
    }
    
    // Add visible range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    // Always include last page
    if (rangeEnd < totalPages) {
      if (rangeEnd < totalPages - 1) {
        pages.push(-1); // Ellipsis marker
      }
      pages.push(totalPages);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();
  
  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults || 0);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Results info */}
      {totalResults && (
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{startResult}</span> to{' '}
          <span className="font-medium">{endResult}</span> of{' '}
          <span className="font-medium">{totalResults.toLocaleString()}</span> results
        </div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center space-x-2">
        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`
            inline-flex items-center px-2 py-2 text-sm font-medium rounded-md
            ${currentPage <= 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Previous</span>
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {visiblePages.map((page, index) => (
            page === -1 ? (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-sm text-gray-500"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`
                  px-3 py-2 text-sm font-medium rounded-md min-w-[2.5rem]
                  ${page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {page}
              </button>
            )
          ))}
        </div>

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`
            inline-flex items-center px-2 py-2 text-sm font-medium rounded-md
            ${currentPage >= totalPages
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};