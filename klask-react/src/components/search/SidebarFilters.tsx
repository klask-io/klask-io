import React from 'react';
import { useLocation } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FolderIcon, TagIcon, DocumentIcon } from '@heroicons/react/24/solid';

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

interface SidebarFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableFilters: {
    projects: FilterOption[];
    versions: FilterOption[];
    extensions: FilterOption[];
    languages: FilterOption[];
  };
  isLoading?: boolean;
  currentQuery?: string;
}

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  filters,
  onFiltersChange,
  availableFilters,
  isLoading = false,
  currentQuery = '',
}) => {
  const location = useLocation();

  // Only show on search page
  if (!location.pathname.startsWith('/search')) {
    return null;
  }

  // Don't show if no search query and no filters available
  if (!currentQuery.trim() &&
      availableFilters.projects.length === 0 &&
      availableFilters.versions.length === 0 &&
      availableFilters.extensions.length === 0) {
    return null;
  }

  const handleFilterChange = (key: keyof SearchFilters, value: string, checked: boolean) => {
    const currentValues = filters[key] || [];
    let newValues: string[];

    if (checked) {
      // Add value if not already present
      newValues = currentValues.includes(value) ? currentValues : [...currentValues, value];
    } else {
      // Remove value
      newValues = currentValues.filter(v => v !== value);
    }

    onFiltersChange({
      ...filters,
      [key]: newValues.length > 0 ? newValues : undefined,
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

  const hasActiveFilters = Object.values(filters).some(filterArray => filterArray && filterArray.length > 0);

  const FilterSection: React.FC<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    options: FilterOption[];
    selectedValues: string[];
    filterKey: keyof SearchFilters;
  }> = ({ title, icon: Icon, options, selectedValues, filterKey }) => {
    if (options.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Icon className="h-4 w-4 text-gray-500" />
            <h4 className="text-xs font-medium text-gray-900 uppercase tracking-wide">{title}</h4>
          </div>
          {selectedValues.length > 0 && (
            <button
              onClick={() => clearFilter(filterKey)}
              className="text-xs text-gray-400 hover:text-gray-600"
              title="Clear filter"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="space-y-1 max-h-32 overflow-y-auto">
          {options.slice(0, 8).map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => handleFilterChange(filterKey, option.value, !isSelected)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors text-sm ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="truncate text-xs min-w-0 flex-1" title={option.label}>
                  {option.label}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded ml-2">
                  {option.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wide">
          Search Filters
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {Object.entries(filters).map(([key, values]) =>
              values && values.length > 0 ? (
                <div key={key} className="space-y-1">
                  {values.map((value, index) => (
                    <div
                      key={`${key}-${value}`}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded mr-1 mb-1"
                    >
                      <span className="capitalize">{key}:</span>
                      <span className="font-medium truncate max-w-20" title={value}>{value}</span>
                      <button
                        onClick={() => {
                          const currentValues = filters[key as keyof SearchFilters] || [];
                          const newValues = currentValues.filter(v => v !== value);
                          onFiltersChange({
                            ...filters,
                            [key]: newValues.length > 0 ? newValues : undefined,
                          });
                        }}
                        className="hover:text-blue-600"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="text-xs text-gray-500 mb-4">Loading filters...</div>
      ) : (
        <>
          {/* Filter Sections */}
          <FilterSection
            title="Projects"
            icon={FolderIcon}
            options={availableFilters.projects}
            selectedValues={filters.project || []}
            filterKey="project"
          />

          <FilterSection
            title="Versions"
            icon={TagIcon}
            options={availableFilters.versions}
            selectedValues={filters.version || []}
            filterKey="version"
          />

          <FilterSection
            title="Extensions"
            icon={DocumentIcon}
            options={availableFilters.extensions}
            selectedValues={filters.extension || []}
            filterKey="extension"
          />

          {availableFilters.languages.length > 0 && (
            <FilterSection
              title="Languages"
              icon={DocumentIcon}
              options={availableFilters.languages}
              selectedValues={filters.language || []}
              filterKey="language"
            />
          )}
        </>
      )}
    </div>
  );
};