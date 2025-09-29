import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { XMarkIcon, FolderIcon, GlobeAltIcon, ServerIcon } from '@heroicons/react/24/outline';
import type { Repository, RepositoryType } from '../../types';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CronScheduleForm } from './CronScheduleForm';

const createRepositorySchema = (isEditing: boolean, hasExistingToken: boolean) => z.object({
  name: z
    .string()
    .min(1, 'Repository name is required')
    .min(2, 'Repository name must be at least 2 characters')
    .max(100, 'Repository name must be less than 100 characters'),
  url: z
    .string()
    .optional(),
  repositoryType: z.enum(['Git', 'GitLab', 'FileSystem'] as const),
  branch: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 1, 'Branch name cannot be empty if provided'),
  accessToken: z
    .string()
    .optional()
    .refine(() => {
      // Only validate as required for new GitLab repositories in create mode
      return true; // Let the main refine handle the validation contextually
    }),
  gitlabNamespace: z
    .string()
    .optional(),
  gitlabExcludedProjects: z
    .string()
    .optional(),
  gitlabExcludedPatterns: z
    .string()
    .optional(),
  isGroup: z.boolean().optional(),
  enabled: z.boolean(),
}).refine((data) => {
  // For GitLab, accessToken is required only for new repositories
  // For editing, we allow empty token if it was previously set
  if (data.repositoryType === 'GitLab') {
    // For new repositories, accessToken is required
    if (!isEditing && (!data.accessToken || data.accessToken.trim() === '')) {
      return false;
    }
    // For editing, accessToken is optional if it was previously set
    if (isEditing && !hasExistingToken && (!data.accessToken || data.accessToken.trim() === '')) {
      return false;
    }
    // If URL is provided, validate it
    if (data.url && data.url.trim() !== '') {
      try {
        new URL(data.url);
      } catch {
        return false;
      }
    }
    return true;
  }
  // For Git, URL is required and must be valid
  if (data.repositoryType === 'Git') {
    if (!data.url || data.url.trim() === '') return false;
    try {
      new URL(data.url);
      return true;
    } catch {
      return false;
    }
  }
  // For FileSystem, validate as path
  if (data.repositoryType === 'FileSystem') {
    if (!data.url || data.url.trim() === '') return false;
    return data.url.startsWith('/') || data.url.match(/^[a-zA-Z]:[\\//]/);
  }
  return true;
}, {
  message: 'Please provide valid URL/path for the selected repository type',
  path: ['url'],
}).refine((data) => {
  // Additional validation for GitLab access token
  if (data.repositoryType === 'GitLab' && (!data.accessToken || data.accessToken.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Access token is required for GitLab repositories',
  path: ['accessToken'],
});

// Create base type from the schema creation function
type BaseRepositoryFormData = z.infer<ReturnType<typeof createRepositorySchema>>;

// Define a type that includes scheduling data
type RepositoryFormSubmitData = BaseRepositoryFormData & {
  autoCrawlEnabled: boolean;
  cronSchedule?: string;
  crawlFrequencyHours?: number;
  maxCrawlDurationMinutes: number;
};

interface RepositoryFormProps {
  repository?: Repository;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RepositoryFormSubmitData) => void;
  isLoading?: boolean;
  title?: string;
}

export const RepositoryForm: React.FC<RepositoryFormProps> = ({
  repository,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  title,
}) => {
  const isEditing = !!repository;
  const formTitle = title || (isEditing ? 'Edit Repository' : 'Add Repository');

  // Scheduling state
  const [schedulingData, setSchedulingData] = useState({
    autoCrawlEnabled: repository?.autoCrawlEnabled || false,
    cronSchedule: repository?.cronSchedule,
    crawlFrequencyHours: repository?.crawlFrequencyHours,
    maxCrawlDurationMinutes: repository?.maxCrawlDurationMinutes || 60,
  });

  // Track if scheduling data has changed for edit mode
  const [hasSchedulingChanged, setHasSchedulingChanged] = useState(false);

  // Track if user wants to change the access token in edit mode
  const [showTokenField, setShowTokenField] = useState(!isEditing);
  const hasExistingToken = isEditing && !!repository?.accessToken;

  const repositorySchema = createRepositorySchema(isEditing, hasExistingToken);
  type RepositoryFormData = z.infer<typeof repositorySchema>;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<RepositoryFormData>({
    resolver: zodResolver(repositorySchema),
    defaultValues: repository ? {
      name: repository.name,
      url: repository.url,
      repositoryType: repository.repositoryType,
      branch: repository.branch || '',
      enabled: repository.enabled,
      accessToken: repository.accessToken || '',
      gitlabNamespace: repository.gitlabNamespace || '',
      gitlabExcludedProjects: repository.gitlabExcludedProjects || '',
      gitlabExcludedPatterns: repository.gitlabExcludedPatterns || '',
      isGroup: repository.isGroup || false,
    } : {
      name: '',
      url: '',
      repositoryType: 'Git',
      branch: '',
      enabled: true,
      accessToken: '',
      gitlabNamespace: '',
      gitlabExcludedProjects: '',
      gitlabExcludedPatterns: '',
      isGroup: false,
    },
  });

  const watchedType = watch('repositoryType');
  
  // Debug: Monitor button state
  React.useEffect(() => {
    const shouldDisable = (() => {
      if (!isValid || isLoading) return true;
      if (!isEditing) return false;
      return !isDirty && !hasSchedulingChanged;
    })();
    
    console.log('Form state:', {
      isValid,
      isEditing,
      isDirty,
      hasSchedulingChanged,
      buttonWillBeDisabled: shouldDisable,
      errors: Object.keys(errors).length > 0 ? errors : 'none'
    });
  }, [isValid, isLoading, isEditing, isDirty, hasSchedulingChanged, errors]);

  // Handle scheduling data changes
  const handleScheduleChange = useCallback((newSchedulingData: {
    autoCrawlEnabled: boolean;
    cronSchedule?: string;
    crawlFrequencyHours?: number;
    maxCrawlDurationMinutes?: number;
  }) => {
    setSchedulingData({
      autoCrawlEnabled: newSchedulingData.autoCrawlEnabled,
      cronSchedule: newSchedulingData.cronSchedule || undefined,
      crawlFrequencyHours: newSchedulingData.crawlFrequencyHours || undefined,
      maxCrawlDurationMinutes: newSchedulingData.maxCrawlDurationMinutes || 60,
    });
    
    if (isEditing && repository) {
      // Check if scheduling data has changed
      // For comparison, treat undefined, null, and empty string as equivalent
      const areEqual = (a: string | null | undefined, b: string | null | undefined) => {
        if ((a === undefined || a === null || a === '') && 
            (b === undefined || b === null || b === '')) {
          return true;
        }
        return a === b;
      };
      
      const hasChanged = 
        repository.autoCrawlEnabled !== newSchedulingData.autoCrawlEnabled ||
        !areEqual(repository.cronSchedule, newSchedulingData.cronSchedule) ||
        repository.crawlFrequencyHours !== newSchedulingData.crawlFrequencyHours ||
        (repository.maxCrawlDurationMinutes || 60) !== newSchedulingData.maxCrawlDurationMinutes;
      
      // Only log when there's an actual change
      if (hasChanged) {
        console.log('Schedule changed:', hasChanged);
      }
      
      setHasSchedulingChanged(hasChanged);
    }
  }, [isEditing, repository]);

  // Track the repository ID to detect when we switch repositories
  const [currentRepositoryId, setCurrentRepositoryId] = React.useState(repository?.id);
  
  React.useEffect(() => {
    // Only reset when we actually switch to a different repository
    if (repository?.id !== currentRepositoryId) {
      setCurrentRepositoryId(repository?.id);
      
      if (repository) {
        const formData = {
          name: repository.name,
          url: repository.url,
          repositoryType: repository.repositoryType,
          branch: repository.branch || '',
          enabled: repository.enabled,
          accessToken: repository.accessToken || '',
          gitlabNamespace: repository.gitlabNamespace || '',
          gitlabExcludedProjects: repository.gitlabExcludedProjects || '',
          gitlabExcludedPatterns: repository.gitlabExcludedPatterns || '',
          isGroup: repository.isGroup || false,
        };
        reset(formData);
        setSchedulingData({
          autoCrawlEnabled: repository.autoCrawlEnabled,
          cronSchedule: repository.cronSchedule,
          crawlFrequencyHours: repository.crawlFrequencyHours,
          maxCrawlDurationMinutes: repository.maxCrawlDurationMinutes || 60,
        });
        setHasSchedulingChanged(false);
      } else {
        const formData = {
          name: '',
          url: '',
          repositoryType: 'Git' as RepositoryType,
          branch: '',
          enabled: true,
          accessToken: '',
          gitlabNamespace: '',
          gitlabExcludedProjects: '',
          gitlabExcludedPatterns: '',
          isGroup: false,
        };
        reset(formData);
        setSchedulingData({
          autoCrawlEnabled: false,
          cronSchedule: undefined,
          crawlFrequencyHours: undefined,
          maxCrawlDurationMinutes: 60,
        });
        setHasSchedulingChanged(false);
      }
    }
  }, [repository?.id, repository, reset, currentRepositoryId]);

  const handleFormSubmit = (data: RepositoryFormData) => {
    // Clean up branch field if empty and merge scheduling data
    const submitData: RepositoryFormSubmitData = {
      ...data,
      branch: data.branch?.trim() || undefined,
      // For GitLab repositories, default to gitlab.com if URL is empty
      url: data.repositoryType === 'GitLab' && (!data.url || data.url.trim() === '')
        ? 'https://gitlab.com'
        : data.url,
      // If we're editing and not showing the token field, preserve the existing token
      accessToken: hasExistingToken && !showTokenField
        ? repository?.accessToken
        : data.accessToken,
      ...schedulingData,
    };
    onSubmit(submitData);
  };

  const getTypeIcon = (type: RepositoryType) => {
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

  const getPlaceholderUrl = (type: RepositoryType) => {
    switch (type) {
      case 'Git':
        return 'https://github.com/user/repository.git';
      case 'GitLab':
        return 'https://gitlab.com/user/repository.git';
      case 'FileSystem':
        return '/path/to/local/directory';
      default:
        return 'Enter repository URL';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {formTitle}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Repository Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Repository Name
              </label>
              <input
                {...register('name')}
                type="text"
                className={`input-field ${errors.name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="My Repository"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Repository Type */}
            <div>
              <label htmlFor="repositoryType" className="block text-sm font-medium text-gray-700 mb-1">
                Repository Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['Git', 'GitLab', 'FileSystem'] as const).map((type) => (
                  <label
                    key={type}
                    className={`relative flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      watchedType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      {...register('repositoryType')}
                      type="radio"
                      value={type}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center space-y-1">
                      {getTypeIcon(type)}
                      <span className="text-xs font-medium">{type}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.repositoryType && (
                <p className="mt-1 text-sm text-red-600">{errors.repositoryType.message}</p>
              )}
            </div>

            {/* Repository URL - Not for GitLab type */}
            {watchedType !== 'GitLab' && (
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                  Repository URL
                </label>
                <input
                  {...register('url')}
                  type={watchedType === 'FileSystem' ? 'text' : 'url'}
                  className={`input-field ${errors.url ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder={getPlaceholderUrl(watchedType)}
                />
                {errors.url && (
                  <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {watchedType === 'FileSystem' 
                    ? 'Enter the absolute path to the directory'
                    : 'Enter the full URL to the repository'
                  }
                </p>
              </div>
            )}

            {/* Branch (for Git repositories) */}
            {watchedType !== 'FileSystem' && (
              <div>
                <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">
                  Branch (Optional)
                </label>
                <input
                  {...register('branch')}
                  type="text"
                  className={`input-field ${errors.branch ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder="main"
                />
                {errors.branch && (
                  <p className="mt-1 text-sm text-red-600">{errors.branch.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use the default branch
                </p>
              </div>
            )}

            {/* GitLab-specific fields */}
            {watchedType === 'GitLab' && (
              <>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    GitLab repositories will be automatically discovered and imported using your access token.
                  </p>
                </div>

                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                    GitLab Server URL (Optional)
                  </label>
                  <input
                    {...register('url')}
                    type="url"
                    className={`input-field ${errors.url ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                    placeholder="https://gitlab.com"
                  />
                  {errors.url && (
                    <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to use gitlab.com, or enter your self-hosted GitLab URL
                  </p>
                </div>

                <div>
                  <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Access Token {!isEditing || !hasExistingToken ? '*' : ''}
                  </label>

                  {hasExistingToken && !showTokenField ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                          <span className="text-sm text-green-700">Access token configured</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTokenField(true)}
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Change token
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        {...register('accessToken')}
                        type="password"
                        className={`input-field ${errors.accessToken ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                        placeholder="glpat-..."
                        required={!isEditing || !hasExistingToken}
                      />
                      {hasExistingToken && showTokenField && (
                        <button
                          type="button"
                          onClick={() => setShowTokenField(false)}
                          className="text-sm text-gray-600 hover:text-gray-800 underline"
                        >
                          Keep existing token
                        </button>
                      )}
                    </div>
                  )}

                  {errors.accessToken && (
                    <p className="mt-1 text-sm text-red-600">{errors.accessToken.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Create a token with 'read_repository' scope in GitLab settings
                  </p>
                </div>

                <div>
                  <label htmlFor="gitlabNamespace" className="block text-sm font-medium text-gray-700 mb-1">
                    Namespace Filter (Optional)
                  </label>
                  <input
                    {...register('gitlabNamespace')}
                    type="text"
                    className={`input-field ${errors.gitlabNamespace ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                    placeholder="username or group-name"
                  />
                  {errors.gitlabNamespace && (
                    <p className="mt-1 text-sm text-red-600">{errors.gitlabNamespace.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Filter to only import repositories from a specific namespace
                  </p>
                </div>

                <div>
                  <label htmlFor="gitlabExcludedProjects" className="block text-sm font-medium text-gray-700 mb-1">
                    Excluded Projects (Optional)
                  </label>
                  <input
                    {...register('gitlabExcludedProjects')}
                    type="text"
                    className={`input-field ${errors.gitlabExcludedProjects ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                    placeholder="team/project-archive, old/legacy-system"
                  />
                  {errors.gitlabExcludedProjects && (
                    <p className="mt-1 text-sm text-red-600">{errors.gitlabExcludedProjects.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Comma-separated list of exact project paths to exclude
                  </p>
                </div>

                <div>
                  <label htmlFor="gitlabExcludedPatterns" className="block text-sm font-medium text-gray-700 mb-1">
                    Excluded Patterns (Optional)
                  </label>
                  <input
                    {...register('gitlabExcludedPatterns')}
                    type="text"
                    className={`input-field ${errors.gitlabExcludedPatterns ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                    placeholder="*-archive, test-*, *-temp"
                  />
                  {errors.gitlabExcludedPatterns && (
                    <p className="mt-1 text-sm text-red-600">{errors.gitlabExcludedPatterns.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Comma-separated patterns with wildcards (*) to exclude projects
                  </p>
                </div>
              </>
            )}

            {/* Enabled Toggle */}
            <div className="flex items-center">
              <input
                {...register('enabled')}
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                Enable this repository for crawling
              </label>
            </div>

            {/* Scheduling Section */}
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Automatic Crawling Schedule</h4>
              <CronScheduleForm
                autoCrawlEnabled={schedulingData.autoCrawlEnabled}
                cronSchedule={schedulingData.cronSchedule}
                crawlFrequencyHours={schedulingData.crawlFrequencyHours}
                maxCrawlDurationMinutes={schedulingData.maxCrawlDurationMinutes}
                onScheduleChange={handleScheduleChange}
                repositoryId={repository?.id}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={(() => {
                  // Always disable if invalid or loading
                  if (!isValid || isLoading) return true;
                  
                  // For new repositories, enable if valid
                  if (!isEditing) return false;
                  
                  // For editing, enable if anything changed
                  return !isDirty && !hasSchedulingChanged;
                })()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {isEditing ? 'Update Repository' : 'Create Repository'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};