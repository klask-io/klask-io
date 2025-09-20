import React from 'react';
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  label = 'Loading...'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={clsx('flex items-center justify-center', className)} data-testid="loading-spinner">
      <div className="flex items-center space-x-3">
        <div
          className={clsx(
            'animate-spin rounded-full border-2 border-primary-200 border-t-primary-600',
            sizeClasses[size]
          )}
          role="status"
          aria-label={label}
        />
        {label && (
          <span className="text-sm text-secondary-600">{label}</span>
        )}
      </div>
    </div>
  );
};

interface FullPageSpinnerProps {
  message?: string;
}

export const FullPageSpinner: React.FC<FullPageSpinnerProps> = ({
  message = 'Loading...'
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-secondary-600">{message}</p>
      </div>
    </div>
  );
};

interface InlineSpinnerProps {
  size?: 'sm' | 'md';
  className?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({ 
  size = 'sm', 
  className 
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  return (
    <div
      className={clsx(
        'animate-spin rounded-full border border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-hidden="true"
    />
  );
};