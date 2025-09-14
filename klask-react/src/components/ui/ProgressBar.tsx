import React from 'react';

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