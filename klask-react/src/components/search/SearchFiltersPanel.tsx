import React from 'react';
import {
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  CodeBracketIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

export interface FacetValue {
  value: string;
  count: number;
}

export interface SearchFacets {
  projects: FacetValue[];
  versions: FacetValue[];
  extensions: FacetValue[];
}

export interface SearchFilters {
  project?: string;
  version?: string;
  extension?: string;
  [key: string]: string | undefined;
}

interface SearchFiltersPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  facets?: SearchFacets;
  isLoading?: boolean;
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  facetValues: FacetValue[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  isLoading?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  icon,
  facetValues,
  selectedValue,
  onSelect,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3">
          {isLoading ? (
            <div className="text-xs text-gray-500 italic py-2">Loading...</div>
          ) : facetValues.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">No options available</div>
          ) : (
            <div className="space-y-1">
              {/* Show "All" option */}
              <button
                onClick={() => onSelect('')}
                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 transition-colors flex items-center justify-between ${
                  !selectedValue ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                <span>All</span>
                <span className="text-xs text-gray-500">
                  {facetValues.reduce((sum, f) => sum + f.count, 0)}
                </span>
              </button>

              {/* Show facet values */}
              {facetValues.slice(0, 10).map((facet) => (
                <button
                  key={facet.value}
                  onClick={() => onSelect(facet.value)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 transition-colors flex items-center justify-between ${
                    selectedValue === facet.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  <span className="truncate mr-2">{facet.value}</span>
                  <span className="flex-shrink-0 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">
                    {facet.count}
                  </span>
                </button>
              ))}

              {facetValues.length > 10 && (
                <div className="text-xs text-gray-500 italic pt-1">
                  +{facetValues.length - 10} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SearchFiltersPanel: React.FC<SearchFiltersPanelProps> = ({
  filters,
  onFiltersChange,
  facets,
  isLoading = false,
}) => {
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                {activeFilterCount}
              </span>
            )}
          </div>
          
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(filters).map(([key, value]) => 
              value ? (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 text-blue-800 text-xs rounded-full"
                >
                  <span className="capitalize">{key}:</span>
                  <span className="font-medium">{value}</span>
                  <button
                    onClick={() => {
                      const newFilters = { ...filters };
                      delete newFilters[key];
                      onFiltersChange(newFilters);
                    }}
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

      {/* Filter Sections */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <FilterSection
          title="Projects"
          icon={<FolderIcon className="h-4 w-4 text-gray-500" />}
          facetValues={facets?.projects || []}
          selectedValue={filters.project}
          onSelect={(value) => handleFilterChange('project', value)}
          isLoading={isLoading}
        />

        <FilterSection
          title="Versions"
          icon={<ClockIcon className="h-4 w-4 text-gray-500" />}
          facetValues={facets?.versions || []}
          selectedValue={filters.version}
          onSelect={(value) => handleFilterChange('version', value)}
          isLoading={isLoading}
        />

        <FilterSection
          title="File Types"
          icon={<CodeBracketIcon className="h-4 w-4 text-gray-500" />}
          facetValues={facets?.extensions || []}
          selectedValue={filters.extension}
          onSelect={(value) => handleFilterChange('extension', value)}
          isLoading={isLoading}
        />
      </div>

      {/* Footer Stats */}
      {facets && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total Results:</span>
              <span className="font-medium">
                {facets.projects.reduce((sum, f) => sum + f.count, 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};