import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  FolderIcon,
  GlobeAltIcon,
  ServerIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import type { Repository } from '../../types';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CrawlProgressBar } from '../ui/ProgressBar';
import { useActiveProgress, isRepositoryCrawling, getRepositoryProgressFromActive } from '../../hooks/useProgress';

interface RepositoryCardProps {
  repository: Repository;
  onEdit: (repository: Repository) => void;
  onDelete: (repository: Repository) => void;
  onCrawl: (repository: Repository) => void;
  onToggleEnabled: (repository: Repository) => void;
  isLoading?: boolean;
  isCrawling?: boolean;
  className?: string;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  onEdit,
  onDelete,
  onCrawl,
  onToggleEnabled,
  isLoading = false,
  isCrawling = false,
  className = '',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { activeProgress } = useActiveProgress();
  
  // Check if this repository is currently crawling
  const isCurrentlyCrawling = isRepositoryCrawling(repository.id, activeProgress);
  const crawlProgress = getRepositoryProgressFromActive(repository.id, activeProgress);
  
  // Override the isCrawling prop with real-time data
  const actuallyIsCrawling = isCurrentlyCrawling || isCrawling;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Git':
        return <GlobeAltIcon className="h-5 w-5" />;
      case 'GitLab':
        return <GlobeAltIcon className="h-5 w-5" />;
      case 'FileSystem':
        return <ServerIcon className="h-5 w-5" />;
      default:
        return <FolderIcon className="h-5 w-5" />;
    }
  };

  const getStatusColor = () => {
    if (!repository.enabled) return 'text-gray-400';
    if (repository.lastCrawled) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getStatusIcon = () => {
    if (!repository.enabled) {
      return <PauseCircleIcon className="h-5 w-5 text-gray-400" />;
    }
    if (repository.lastCrawled) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (!repository.enabled) return 'Disabled';
    if (repository.lastCrawled) return 'Ready';
    return 'Not Crawled';
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const formatLastCrawled = (date: string | null | undefined) => {
    if (!date) return 'Never';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const formatCreatedAt = (date: string | null | undefined) => {
    if (!date) return 'Unknown time ago';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Unknown time ago';
      return formatDistanceToNow(dateObj, { addSuffix: true });
    } catch {
      return 'Unknown time ago';
    }
  };

  const formatNextCrawl = (date: string | null | undefined) => {
    if (!date) return null;
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return null;
      return formatDistanceToNow(dateObj, { addSuffix: true });
    } catch {
      return null;
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className={`flex-shrink-0 ${getStatusColor()}`}>
              {getTypeIcon(repository.repositoryType)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {repository.name}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                {repository.url}
              </p>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={handleMenuClick}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <EllipsisVerticalIcon className="h-5 w-5" />
              )}
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onEdit(repository);
                      setShowMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <PencilIcon className="h-4 w-4 mr-3" />
                    Edit
                  </button>
                  
                  <button
                    onClick={() => {
                      onToggleEnabled(repository);
                      setShowMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {repository.enabled ? (
                      <>
                        <PauseCircleIcon className="h-4 w-4 mr-3" />
                        Disable
                      </>
                    ) : (
                      <>
                        <PlayCircleIcon className="h-4 w-4 mr-3" />
                        Enable
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      onCrawl(repository);
                      setShowMenu(false);
                    }}
                    disabled={!repository.enabled || actuallyIsCrawling}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowPathIcon className={`h-4 w-4 mr-3 ${actuallyIsCrawling ? 'animate-spin' : ''}`} />
                    {actuallyIsCrawling ? 'Crawling...' : 'Crawl Now'}
                  </button>
                  
                  <hr className="my-1" />
                  
                  <button
                    onClick={() => {
                      onDelete(repository);
                      setShowMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4 mr-3" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-gray-500">
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {repository.repositoryType}
            </span>
            {repository.branch && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {repository.branch}
              </span>
            )}
            {repository.autoCrawlEnabled && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center space-x-1">
                <BoltIcon className="h-3 w-3" />
                <span>Auto-crawl</span>
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <ClockIcon className="h-4 w-4 flex-shrink-0" />
            <span>Last crawled: {formatLastCrawled(repository.lastCrawled)}</span>
          </div>
          
          {repository.autoCrawlEnabled && repository.nextCrawlAt && (
            <div className="flex items-center space-x-2 text-green-600">
              <BoltIcon className="h-4 w-4 flex-shrink-0" />
              <span>Next crawl: {formatNextCrawl(repository.nextCrawlAt)}</span>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">
              Created {formatCreatedAt(repository.createdAt)}
            </span>
          </div>
        </div>

        {/* Progress Bar - Show when crawling */}
        {crawlProgress && actuallyIsCrawling && (
          <div className="mt-4">
            <CrawlProgressBar
              repositoryName={crawlProgress.repository_name}
              status={crawlProgress.status}
              progress={crawlProgress.progress_percentage}
              filesProcessed={crawlProgress.files_processed}
              filesTotal={crawlProgress.files_total}
              filesIndexed={crawlProgress.files_indexed}
              currentFile={crawlProgress.current_file}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="flex space-x-2">
            <button
              onClick={() => onToggleEnabled(repository)}
              disabled={isLoading}
              className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                repository.enabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {repository.enabled ? (
                <>
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <XCircleIcon className="h-3 w-3 mr-1" />
                  Disabled
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => onCrawl(repository)}
            disabled={!repository.enabled || actuallyIsCrawling || isLoading}
            className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowPathIcon className={`h-3 w-3 mr-1 ${actuallyIsCrawling ? 'animate-spin' : ''}`} />
            {actuallyIsCrawling ? 'Crawling' : 'Crawl'}
          </button>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};