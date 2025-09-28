import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FolderIcon, TagIcon, DocumentIcon } from '@heroicons/react/24/solid';

export interface SearchFilters {
  project?: string;
  version?: string;
  extension?: string;
  language?: string;
  [key: string]: string | undefined;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface SearchFiltersV3Props {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableFilters: {
    projects: FilterOption[];
    versions: FilterOption[];
    extensions: FilterOption[];
    languages: FilterOption[];
  };
  isLoading?: boolean;
}

export const SearchFiltersV3: React.FC<SearchFiltersV3Props> = ({
  filters,
  onFiltersChange,
  availableFilters,
  isLoading = false,
}) => {
  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const clearFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const FilterSection: React.FC<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    options: FilterOption[];
    selectedValue: string | undefined;
    filterKey: keyof SearchFilters;
  }> = ({ title, icon: Icon, options, selectedValue, filterKey }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
        {selectedValue && (
          <button
            onClick={() => clearFilter(filterKey)}
            className="text-xs text-gray-400 hover:text-gray-600"
            title="Clear filter"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-40 overflow-y-auto">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : options.length > 0 ? (
          options.slice(0, 10).map((option) => (
            <label
              key={option.value}
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                selectedValue === option.value
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <input
                  type="radio"
                  name={filterKey as string}
                  value={option.value}
                  checked={selectedValue === option.value}
                  onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 truncate" title={option.label}>
                  {option.label}
                </span>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2">
                {option.count}
              </span>
            </label>
          ))
        ) : (
          <div className="text-sm text-gray-500">No options available</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Active Filters</h3>
          <div className="space-y-1">
            {Object.entries(filters).map(([key, value]) =>
              value ? (
                <div
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full mr-1 mb-1"
                >
                  <span className="capitalize">{key}:</span>
                  <span className="font-medium">{value}</span>
                  <button
                    onClick={() => clearFilter(key as keyof SearchFilters)}
                    className="ml-1 hover:text-blue-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Filter Sections */}
      <FilterSection
        title="Project"
        icon={FolderIcon}
        options={availableFilters.projects}
        selectedValue={filters.project}
        filterKey="project"
      />

      <FilterSection
        title="Version"
        icon={TagIcon}
        options={availableFilters.versions}
        selectedValue={filters.version}
        filterKey="version"
      />

      <FilterSection
        title="File Extension"
        icon={DocumentIcon}
        options={availableFilters.extensions}
        selectedValue={filters.extension}
        filterKey="extension"
      />

      {availableFilters.languages.length > 0 && (
        <FilterSection
          title="Language"
          icon={DocumentIcon}
          options={availableFilters.languages}
          selectedValue={filters.language}
          filterKey="language"
        />
      )}
    </div>
  );
};