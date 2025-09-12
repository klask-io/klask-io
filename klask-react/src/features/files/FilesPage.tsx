import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  DocumentIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useSearchResults } from '../../hooks/useSearch';
import { SearchResult as SearchResultType } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatFileSize } from '../../lib/utils';

const FilesPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExtension, setSelectedExtension] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  
  const limit = 50;
  const offset = (currentPage - 1) * limit;

  // For now, use a broad search to get all files. In a real implementation,
  // there would be a dedicated API endpoint for listing all files
  const query = searchQuery || '*'; // Use wildcard to get all files when no search query
  
  const { 
    data: searchResults, 
    isLoading, 
    error 
  } = useSearchResults(query, {
    limit,
    offset,
    extension: selectedExtension || undefined,
    project: selectedProject || undefined,
  });

  const results = searchResults?.results || [];
  const totalResults = searchResults?.total || 0;
  const totalPages = Math.ceil(totalResults / limit);

  // Extract unique extensions and projects for filters
  const extensions = Array.from(
    new Set(results.map(result => result.extension).filter(Boolean))
  ).sort();
  
  const projects = Array.from(
    new Set(results.map(result => result.project).filter(Boolean))
  ).sort();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedExtension('');
    setSelectedProject('');
    setCurrentPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Files
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse all indexed files across repositories
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-slate-700 mb-1">
                Project
              </label>
              <select
                id="project"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All projects</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="extension" className="block text-sm font-medium text-slate-700 mb-1">
                File Type
              </label>
              <select
                id="extension"
                value={selectedExtension}
                onChange={(e) => setSelectedExtension(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All types</option>
                {extensions.map(ext => (
                  <option key={ext} value={ext}>{ext}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end space-x-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Search
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Results Header */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-700">
              {isLoading ? 'Loading...' : `${totalResults} files found`}
            </p>
            {totalResults > 0 && (
              <p className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="px-6 py-12 text-center">
            <div className="text-red-600 mb-2">Error loading files</div>
            <div className="text-sm text-slate-500">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && results.length === 0 && (
          <div className="px-6 py-12 text-center">
            <DocumentIcon className="mx-auto h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No files found</h3>
            <p className="text-slate-500">
              {searchQuery || selectedExtension || selectedProject
                ? 'Try adjusting your search or filters'
                : 'No files have been indexed yet'}
            </p>
          </div>
        )}

        {/* Files List */}
        {!isLoading && results.length > 0 && (
          <div className="divide-y divide-slate-200">
            {results.map((result: SearchResultType) => (
              <div key={result.id} className="px-6 py-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <DocumentIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/files/${result.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 truncate"
                        >
                          {result.name}
                        </Link>
                        {result.extension && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {result.extension}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                        <div className="flex items-center">
                          <FolderIcon className="h-4 w-4 mr-1" />
                          {result.path}
                        </div>
                        <div>
                          Project: {result.project}
                        </div>
                        {result.version && (
                          <div>
                            Version: {result.version}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-slate-500">
                    <div className="text-right">
                      <div className="font-medium">
                        Score: {(result.score * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content snippet */}
                {result.content_snippet && (
                  <div className="mt-2 text-sm text-slate-600 bg-slate-50 rounded p-2 font-mono text-xs">
                    {result.content_snippet.substring(0, 200)}
                    {result.content_snippet.length > 200 && '...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <p className="text-sm text-slate-700">
                  Showing {offset + 1} to {Math.min(offset + limit, totalResults)} of {totalResults} results
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (pageNum > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === currentPage
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilesPage;