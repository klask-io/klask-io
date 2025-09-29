import React from 'react';
import type { CrawlProgressInfo } from '../../types';

export interface ProgressBarProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  variant = 'default',
  showLabel = true,
  label,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const variantClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const backgroundClasses = {
    default: 'bg-blue-100',
    success: 'bg-green-100',
    warning: 'bg-yellow-100',
    error: 'bg-red-100',
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">
            {label || 'Progress'}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
      <div className={`w-full ${backgroundClasses[variant]} rounded-full ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full transition-all duration-300 ease-in-out`}
          style={{
            width: `${clampedProgress}%`,
          }}
        />
      </div>
    </div>
  );
};

export interface CrawlProgressBarProps {
  repositoryName: string;
  status: string;
  progress: number;
  filesProcessed: number;
  filesTotal?: number;
  filesIndexed: number;
  currentFile?: string;
  className?: string;
}

export const CrawlProgressBar: React.FC<CrawlProgressBarProps> = ({
  repositoryName,
  status,
  progress,
  filesProcessed,
  filesTotal,
  filesIndexed,
  currentFile,
  className = '',
}) => {
  const getVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      case 'starting':
      case 'cloning':
      case 'processing':
      case 'indexing':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'starting':
        return 'Starting crawl...';
      case 'cloning':
        return 'Cloning repository...';
      case 'processing':
        return 'Processing files...';
      case 'indexing':
        return 'Indexing content...';
      case 'completed':
        return 'Crawl completed';
      case 'failed':
        return 'Crawl failed';
      case 'cancelled':
        return 'Crawl cancelled';
      default:
        return status;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{repositoryName}</h4>
          <p className="text-xs text-gray-500">{getStatusText(status)}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-medium text-gray-700">
            {Math.round(progress)}%
          </span>
          {filesTotal && (
            <p className="text-xs text-gray-500">
              {filesProcessed} / {filesTotal} files
            </p>
          )}
        </div>
      </div>
      
      <ProgressBar
        progress={progress}
        variant={getVariant(status)}
        showLabel={false}
        size="md"
      />
      
      <div className="space-y-1 text-xs text-gray-600">
        {filesTotal && (
          <div className="flex justify-between">
            <span>Files processed: {filesProcessed}</span>
            <span>Files indexed: {filesIndexed}</span>
          </div>
        )}
        {currentFile && (
          <div className="truncate" title={currentFile}>
            <span className="text-gray-500">Current file: </span>
            <span className="font-mono">{currentFile}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export interface GitLabHierarchicalProgressBarProps {
  progressInfo: CrawlProgressInfo;
  className?: string;
}

export const GitLabHierarchicalProgressBar: React.FC<GitLabHierarchicalProgressBarProps> = ({
  progressInfo,
  className = '',
}) => {
  const {
    repository_name,
    status,
    progress_percentage,
    files_processed,
    files_total,
    files_indexed,
    current_file,
    projects_processed,
    projects_total,
    current_project,
    current_project_files_processed,
    current_project_files_total,
  } = progressInfo;

  const getVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'starting':
        return 'Starting GitLab discovery...';
      case 'cloning':
        return 'Discovering GitLab projects...';
      case 'processing':
        return 'Processing projects...';
      case 'indexing':
        return 'Indexing content...';
      case 'completed':
        return 'GitLab crawl completed';
      case 'failed':
        return 'GitLab crawl failed';
      case 'cancelled':
        return 'GitLab crawl cancelled';
      default:
        return status;
    }
  };

  // Calculate project progress percentage
  const projectProgress = projects_total && projects_processed 
    ? (projects_processed / projects_total) * 100 
    : 0;

  // Calculate current project file progress percentage
  const currentProjectProgress = current_project_files_total && current_project_files_processed
    ? (current_project_files_processed / current_project_files_total) * 100
    : 0;

  const isGitLabRepository = projects_total !== undefined && projects_total > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Repository Header */}
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{repository_name}</h4>
          <p className="text-xs text-gray-500">{getStatusText(status)}</p>
        </div>
        <div className="text-right">
          {isGitLabRepository ? (
            <>
              <span className="text-sm font-medium text-gray-700">
                {projects_processed || 0} / {projects_total} projects
              </span>
              <p className="text-xs text-gray-500">
                {Math.round(projectProgress)}%
              </p>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-700">
              {Math.round(progress_percentage)}%
            </span>
          )}
        </div>
      </div>

      {/* Main Progress Bar */}
      {isGitLabRepository ? (
        /* For GitLab: Main progress = Projects progress */
        <ProgressBar
          progress={projectProgress}
          variant={getVariant(status)}
          showLabel={false}
          size="md"
        />
      ) : (
        /* For other repos: Main progress = Overall progress */
        <ProgressBar
          progress={progress_percentage}
          variant={getVariant(status)}
          showLabel={false}
          size="md"
        />
      )}

      {/* GitLab Current Project Files Progress */}
      {isGitLabRepository && current_project && (
        <div className="space-y-1 pl-2 border-l-2 border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-600 truncate" title={current_project}>
              📂 {current_project}
            </span>
            {current_project_files_total && (
              <span className="text-xs text-gray-500">
                {current_project_files_processed || 0} / {current_project_files_total} files
              </span>
            )}
          </div>
          {current_project_files_total && (
            <ProgressBar
              progress={currentProjectProgress}
              variant="default"
              showLabel={false}
              size="sm"
            />
          )}
        </div>
      )}

      {/* Summary Information */}
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Total files processed: {files_processed}</span>
          <span>Files indexed: {files_indexed}</span>
        </div>
        {current_file && (
          <div className="truncate" title={current_file}>
            <span className="text-gray-500">Current file: </span>
            <span className="font-mono">{current_file}</span>
          </div>
        )}
      </div>
    </div>
  );
};