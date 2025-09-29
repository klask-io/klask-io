import React from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface SearchFilters {
  project?: string;
  version?: string;
  extension?: string;
  language?: string;
  [key: string]: string | undefined;
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableFilters: {
    projects: string[];
    versions: string[];
    extensions: string[];
    languages: string[];
  };
  isLoading?: boolean;
}

export const SearchFiltersComponent: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
  availableFilters,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const clearFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <FunnelIcon className="h-4 w-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {Object.values(filters).filter(Boolean).length}
              </span>
            )}
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <select
                value={filters.project || ''}
                onChange={(e) => handleFilterChange('project', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="">All projects</option>
                {availableFilters.projects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>

            {/* Version Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version
              </label>
              <select
                value={filters.version || ''}
                onChange={(e) => handleFilterChange('version', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="">All versions</option>
                {availableFilters.versions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>

            {/* Extension Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File Extension
              </label>
              <select
                value={filters.extension || ''}
                onChange={(e) => handleFilterChange('extension', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="">All extensions</option>
                {availableFilters.extensions.map((extension) => (
                  <option key={extension} value={extension}>
                    .{extension}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={filters.language || ''}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="">All languages</option>
                {availableFilters.languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => 
                  value ? (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      <span className="capitalize">{key}:</span>
                      <span className="font-medium">{value}</span>
                      <button
                        onClick={() => clearFilter(key as keyof SearchFilters)}
                        className="ml-1 hover:text-blue-600"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};