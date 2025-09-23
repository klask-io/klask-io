import React, { useState, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { SelectableRepositoryCard } from './SelectableRepositoryCard';
import type { Repository, RepositoryWithStats } from '../../types';
import type { CrawlProgressInfo } from '../../hooks/useProgress';

interface GroupedRepositoryListProps {
  repositories: RepositoryWithStats[];
  selectedRepos: string[];
  onToggleSelection: (repositoryId: string) => void;
  onEdit: (repository: RepositoryWithStats) => void;
  onDelete: (repository: RepositoryWithStats) => void;
  onCrawl: (repository: RepositoryWithStats) => void;
  onStopCrawl: (repository: RepositoryWithStats) => void;
  onToggleEnabled: (repository: RepositoryWithStats) => void;
  activeProgress: CrawlProgressInfo[];
  crawlingRepos: Set<string>;
}

interface RepositoryGroup {
  name: string;
  namespace?: string;
  url: string;
  repositories: RepositoryWithStats[];
  type: 'GitLab' | 'Other';
}

export const GroupedRepositoryList: React.FC<GroupedRepositoryListProps> = ({
  repositories,
  selectedRepos,
  onToggleSelection,
  onEdit,
  onDelete,
  onCrawl,
  onStopCrawl,
  onToggleEnabled,
  activeProgress,
  crawlingRepos,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group repositories by GitLab namespace or standalone
  const groupedRepositories = useMemo(() => {
    const groups: Map<string, RepositoryGroup> = new Map();
    const standaloneRepos: RepositoryWithStats[] = [];

    repositories.forEach(repoWithStats => {
      const repo = repoWithStats.repository;
      if (repo.repositoryType === 'GitLab' && repo.gitlabNamespace) {
        // Extract base URL for grouping
        const urlParts = new URL(repo.url);
        const baseUrl = `${urlParts.protocol}//${urlParts.host}`;
        const groupKey = `${baseUrl}/${repo.gitlabNamespace}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            name: repo.gitlabNamespace,
            namespace: repo.gitlabNamespace,
            url: baseUrl,
            repositories: [],
            type: 'GitLab',
          });
        }
        groups.get(groupKey)!.repositories.push(repoWithStats);
      } else {
        standaloneRepos.push(repoWithStats);
      }
    });

    // Sort repositories within each group
    groups.forEach(group => {
      group.repositories.sort((a, b) => a.repository.name.localeCompare(b.repository.name));
    });

    return { groups: Array.from(groups.values()), standalone: standaloneRepos };
  }, [repositories]);

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleGroupSelection = (group: RepositoryGroup) => {
    const groupRepoIds = group.repositories.map(r => r.repository.id);
    const allSelected = groupRepoIds.every(id => selectedRepos.includes(id));
    
    groupRepoIds.forEach(id => {
      const isSelected = selectedRepos.includes(id);
      if (allSelected && isSelected) {
        onToggleSelection(id); // Deselect
      } else if (!allSelected && !isSelected) {
        onToggleSelection(id); // Select
      }
    });
  };

  const isGroupPartiallySelected = (group: RepositoryGroup) => {
    const groupRepoIds = group.repositories.map(r => r.repository.id);
    const selectedCount = groupRepoIds.filter(id => selectedRepos.includes(id)).length;
    return selectedCount > 0 && selectedCount < groupRepoIds.length;
  };

  const isGroupFullySelected = (group: RepositoryGroup) => {
    const groupRepoIds = group.repositories.map(r => r.repository.id);
    return groupRepoIds.length > 0 && groupRepoIds.every(id => selectedRepos.includes(id));
  };

  return (
    <div className="space-y-4">
      {/* GitLab Groups */}
      {groupedRepositories.groups.map(group => {
        const groupKey = `${group.url}/${group.namespace}`;
        const isExpanded = expandedGroups.has(groupKey);
        const partiallySelected = isGroupPartiallySelected(group);
        const fullySelected = isGroupFullySelected(group);

        return (
          <div key={groupKey} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4">
              {/* Group Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    checked={fullySelected}
                    ref={input => {
                      if (input) input.indeterminate = partiallySelected;
                    }}
                    onChange={() => toggleGroupSelection(group)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  
                  {/* Expand/Collapse button */}
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDownIcon className="h-5 w-5" />
                        <FolderOpenIcon className="h-5 w-5 text-yellow-600" />
                      </>
                    ) : (
                      <>
                        <ChevronRightIcon className="h-5 w-5" />
                        <FolderIcon className="h-5 w-5 text-yellow-600" />
                      </>
                    )}
                  </button>
                  
                  {/* Group info */}
                  <div className="flex items-center space-x-2">
                    <GlobeAltIcon className="h-5 w-5 text-orange-500" />
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {group.namespace}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {group.url} • {group.repositories.length} {group.repositories.length === 1 ? 'repository' : 'repositories'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Group stats */}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    GitLab Group
                  </span>
                  <span>
                    {group.repositories.filter(r => r.repository.enabled).length} enabled
                  </span>
                  <span>
                    {group.repositories.filter(r => r.repository.lastCrawled).length} crawled
                  </span>
                </div>
              </div>

              {/* Expanded content - repositories */}
              {isExpanded && (
                <div className="mt-4 space-y-3 pl-11">
                  {group.repositories.map(repoWithStats => (
                    <div key={repoWithStats.repository.id} className="border-l-2 border-gray-200 pl-4">
                      <SelectableRepositoryCard
                        repository={repoWithStats}
                        selected={selectedRepos.includes(repoWithStats.repository.id)}
                        onSelect={(selected) => onToggleSelection(repoWithStats.repository.id)}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onCrawl={onCrawl}
                        onToggleEnabled={onToggleEnabled}
                        activeProgress={activeProgress}
                        isCrawling={crawlingRepos.has(repoWithStats.repository.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Standalone Repositories */}
      {groupedRepositories.standalone.map(repoWithStats => (
        <SelectableRepositoryCard
          key={repoWithStats.repository.id}
          repository={repoWithStats}
          selected={selectedRepos.includes(repoWithStats.repository.id)}
          onSelect={(selected) => onToggleSelection(repoWithStats.repository.id)}
          onEdit={onEdit}
          onDelete={onDelete}
          onCrawl={onCrawl}
          onToggleEnabled={onToggleEnabled}
          activeProgress={activeProgress}
          isCrawling={crawlingRepos.has(repoWithStats.repository.id)}
        />
      ))}
    </div>
  );
};

export default GroupedRepositoryList;