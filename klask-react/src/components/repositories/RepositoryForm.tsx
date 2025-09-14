import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { XMarkIcon, FolderIcon, GlobeAltIcon, ServerIcon } from '@heroicons/react/24/outline';
import type { Repository, RepositoryType } from '../../types';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CronScheduleForm } from './CronScheduleForm';

const repositorySchema = z.object({
  name: z
    .string()
    .min(1, 'Repository name is required')
    .min(2, 'Repository name must be at least 2 characters')
    .max(100, 'Repository name must be less than 100 characters'),
  url: z
    .string()
    .min(1, 'Repository URL is required'),
  repositoryType: z.enum(['Git', 'GitLab', 'FileSystem'] as const),
  branch: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 1, 'Branch name cannot be empty if provided'),
  accessToken: z
    .string()
    .optional(),
  gitlabNamespace: z
    .string()
    .optional(),
  isGroup: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(true),
  // Scheduling fields
  autoCrawlEnabled: z.boolean().optional().default(false),
  cronSchedule: z.string().optional(),
  crawlFrequencyHours: z.number().optional(),
  maxCrawlDurationMinutes: z.number().optional().default(60),
}).refine((data) => {
  // For Git and GitLab, validate as URL
  if (data.repositoryType === 'Git' || data.repositoryType === 'GitLab') {
    try {
      new URL(data.url);
      return true;
    } catch {
      return false;
    }
  }
  // For FileSystem, validate as path (allow any non-empty string that looks like a path)
  if (data.repositoryType === 'FileSystem') {
    return data.url.length > 0 && (data.url.startsWith('/') || data.url.match(/^[a-zA-Z]:[\\\/]/));
  }
  return true;
}, {
  message: 'Please enter a valid URL for Git/GitLab repositories or a valid file path for FileSystem repositories',
  path: ['url'],
});

type RepositoryFormData = z.infer<typeof repositorySchema>;

interface RepositoryFormProps {
  repository?: Repository;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RepositoryFormData) => void;
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

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<RepositoryFormData>({
    resolver: zodResolver(repositorySchema),
    defaultValues: repository ? {
      name: repository.name,
      url: repository.url,
      repositoryType: repository.repositoryType,
      branch: repository.branch || '',
      enabled: repository.enabled,
      autoCrawlEnabled: repository.autoCrawlEnabled,
      cronSchedule: repository.cronSchedule,
      crawlFrequencyHours: repository.crawlFrequencyHours,
      maxCrawlDurationMinutes: repository.maxCrawlDurationMinutes,
    } : {
      name: '',
      url: '',
      repositoryType: 'Git',
      branch: '',
      enabled: true,
      autoCrawlEnabled: false,
      maxCrawlDurationMinutes: 60,
    },
  });

  const watchedType = watch('repositoryType');

  React.useEffect(() => {
    if (repository) {
      const formData = {
        name: repository.name,
        url: repository.url,
        repositoryType: repository.repositoryType,
        branch: repository.branch || '',
        enabled: repository.enabled,
        autoCrawlEnabled: repository.autoCrawlEnabled,
        cronSchedule: repository.cronSchedule,
        crawlFrequencyHours: repository.crawlFrequencyHours,
        maxCrawlDurationMinutes: repository.maxCrawlDurationMinutes,
      };
      reset(formData);
      setSchedulingData({
        autoCrawlEnabled: repository.autoCrawlEnabled,
        cronSchedule: repository.cronSchedule,
        crawlFrequencyHours: repository.crawlFrequencyHours,
        maxCrawlDurationMinutes: repository.maxCrawlDurationMinutes || 60,
      });
    } else {
      const formData = {
        name: '',
        url: '',
        repositoryType: 'Git' as RepositoryType,
        branch: '',
        enabled: true,
        autoCrawlEnabled: false,
        maxCrawlDurationMinutes: 60,
      };
      reset(formData);
      setSchedulingData({
        autoCrawlEnabled: false,
        cronSchedule: undefined,
        crawlFrequencyHours: undefined,
        maxCrawlDurationMinutes: 60,
      });
    }
  }, [repository, reset]);

  const handleFormSubmit = (data: RepositoryFormData) => {
    // Clean up branch field if empty and merge scheduling data
    const cleanedData = {
      ...data,
      branch: data.branch?.trim() || undefined,
      ...schedulingData,
    };
    onSubmit(cleanedData);
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

            {/* Repository URL */}
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

            {/* Access Token (for GitLab) */}
            {watchedType === 'GitLab' && (
              <>
                <div>
                  <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 mb-1">
                    Access Token (Required for private repositories)
                  </label>
                  <input
                    {...register('accessToken')}
                    type="password"
                    className={`input-field ${errors.accessToken ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                    placeholder="glpat-..."
                  />
                  {errors.accessToken && (
                    <p className="mt-1 text-sm text-red-600">{errors.accessToken.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Create a personal access token with 'read_repository' scope in GitLab settings
                  </p>
                </div>

                <div>
                  <label htmlFor="gitlabNamespace" className="block text-sm font-medium text-gray-700 mb-1">
                    GitLab Namespace (Optional)
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
                    Enter a namespace to automatically discover and import all accessible repositories
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    {...register('isGroup')}
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isGroup" className="ml-2 block text-sm text-gray-900">
                    This is a GitLab group (will import all projects in the group)
                  </label>
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
                onScheduleChange={setSchedulingData}
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
                disabled={!isValid || isLoading}
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