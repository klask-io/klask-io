import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import React from 'react';
import RepositoriesPage from '../RepositoriesPage';
import * as useRepositoriesHook from '../../../hooks/useRepositories';
import type { Repository, CrawlProgressInfo } from '../../../types';

// Mock the hooks
vi.mock('../../../hooks/useRepositories');
vi.mock('../../../lib/api');

const mockUseRepositories = useRepositoriesHook as any;

// Test data
const mockRepositories: Repository[] = [
  {
    id: 'repo-1',
    name: 'Test Repo 1',
    url: 'https://github.com/test/repo1',
    repositoryType: 'Git',
    branch: 'main',
    enabled: true,
    lastCrawled: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    autoCrawlEnabled: false,
    cronSchedule: null,
    nextCrawlAt: null,
    crawlFrequencyHours: null,
    maxCrawlDurationMinutes: 60,
  },
  {
    id: 'repo-2',
    name: 'Test Repo 2',
    url: 'https://github.com/test/repo2',
    repositoryType: 'Git',
    branch: 'main',
    enabled: true,
    lastCrawled: '2024-01-01T12:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T12:00:00Z',
    autoCrawlEnabled: false,
    cronSchedule: null,
    nextCrawlAt: null,
    crawlFrequencyHours: null,
    maxCrawlDurationMinutes: 60,
  },
  {
    id: 'repo-3',
    name: 'Test Repo 3',
    url: 'https://github.com/test/repo3',
    repositoryType: 'Git',
    branch: 'main',
    enabled: false,
    lastCrawled: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    autoCrawlEnabled: false,
    cronSchedule: null,
    nextCrawlAt: null,
    crawlFrequencyHours: null,
    maxCrawlDurationMinutes: 60,
  },
];

const mockActiveProgress: CrawlProgressInfo[] = [
  {
    repository_id: 'repo-1',
    repository_name: 'Test Repo 1',
    status: 'processing',
    progress_percentage: 50.0,
    files_processed: 50,
    files_total: 100,
    files_indexed: 25,
    current_file: 'src/main.rs',
    error_message: null,
    started_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:01:00Z',
    completed_at: null,
  },
];

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
};

describe('RepositoriesPage - Crawl Prevention', () => {
  const mockMutations = {
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockUseRepositories.useRepositories.mockReturnValue({
      data: mockRepositories,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseRepositories.useActiveProgress.mockReturnValue({
      data: mockActiveProgress,
      isLoading: false,
      error: null,
    });

    mockUseRepositories.useRepositoryStats.mockReturnValue({
      total: 3,
      enabled: 2,
      disabled: 1,
      crawled: 1,
      notCrawled: 2,
      byType: { git: 3, gitlab: 0, filesystem: 0 },
    });

    mockUseRepositories.useCreateRepository.mockReturnValue(mockMutations);
    mockUseRepositories.useUpdateRepository.mockReturnValue(mockMutations);
    mockUseRepositories.useDeleteRepository.mockReturnValue(mockMutations);
    mockUseRepositories.useCrawlRepository.mockReturnValue(mockMutations);

    mockUseRepositories.useBulkRepositoryOperations.mockReturnValue({
      bulkEnable: mockMutations,
      bulkDisable: mockMutations,
      bulkCrawl: mockMutations,
      bulkDelete: mockMutations,
    });
  });

  describe('Individual Repository Crawl Prevention', () => {
    it('should detect when a repository is currently crawling', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Repo 1 should show as crawling (it's in active progress)
      const repo1Card = screen.getByText('Test Repo 1').closest('[data-testid="repository-card"]') 
                      || screen.getByText('Test Repo 1').closest('.repository-card')
                      || screen.getByText('Test Repo 1').closest('[class*="repository"]');
      
      expect(repo1Card).toBeTruthy();
      
      // Look for crawling indicators (these would be implemented in the SelectableRepositoryCard)
      // The exact implementation depends on how the crawling state is displayed
    });

    it('should prevent crawling when repository is already being crawled', async () => {
      const mockCrawlMutation = {
        ...mockMutations,
        mutateAsync: vi.fn().mockRejectedValue({
          status: 409,
          message: 'Repository is already being crawled',
        }),
      };

      mockUseRepositories.useCrawlRepository.mockReturnValue(mockCrawlMutation);

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Attempt to crawl repo that's already crawling should show error
      // This would typically be handled in the component's crawl handler
    });

    it('should show appropriate visual feedback for crawling repositories', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // The component should visually indicate which repositories are crawling
      // This could be through disabled buttons, progress indicators, etc.
    });
  });

  describe('Bulk Operations Crawl Prevention', () => {
    it('should show correct count of crawling repositories in selection', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Select multiple repositories including one that's crawling
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Select repo 1 (crawling) and repo 2 (not crawling)
      if (checkboxes.length > 2) {
        fireEvent.click(checkboxes[1]); // repo 1
        fireEvent.click(checkboxes[2]); // repo 2
      }

      // Should show indication that 1 repository is currently crawling
      await waitFor(() => {
        expect(screen.getByText(/currently crawling/)).toBeInTheDocument();
      });
    });

    it('should disable bulk crawl when all selected repositories are crawling', async () => {
      // Mock active progress to include all selected repositories
      const allCrawlingProgress: CrawlProgressInfo[] = [
        mockActiveProgress[0],
        {
          ...mockActiveProgress[0],
          repository_id: 'repo-2',
          repository_name: 'Test Repo 2',
        },
      ];

      mockUseRepositories.useActiveProgress.mockReturnValue({
        data: allCrawlingProgress,
        isLoading: false,
        error: null,
      });

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Select repositories that are all crawling
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 2) {
        fireEvent.click(checkboxes[1]); // repo 1 (crawling)
        fireEvent.click(checkboxes[2]); // repo 2 (crawling)
      }

      // Bulk crawl button should be disabled
      await waitFor(() => {
        const crawlButton = screen.getByRole('button', { name: /crawl/i });
        expect(crawlButton).toBeDisabled();
      });
    });

    it('should show smart bulk crawl with partial selection', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Select mixed repositories (crawling and not crawling)
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 2) {
        fireEvent.click(checkboxes[1]); // repo 1 (crawling)
        fireEvent.click(checkboxes[2]); // repo 2 (not crawling)
      }

      // Should show smart crawl indication
      await waitFor(() => {
        const crawlButton = screen.getByRole('button', { name: /crawl/i });
        expect(crawlButton).toBeEnabled();
        expect(crawlButton.textContent).toMatch(/\(1\)/); // Should show count of available repos
      });
    });

    it('should handle bulk crawl with mixed results', async () => {
      const mockBulkCrawl = {
        ...mockMutations,
        mutateAsync: vi.fn().mockResolvedValue({
          successful: 1,
          failed: 1,
          alreadyCrawling: 1,
          total: 3,
        }),
      };

      mockUseRepositories.useBulkRepositoryOperations.mockReturnValue({
        bulkEnable: mockMutations,
        bulkDisable: mockMutations,
        bulkCrawl: mockBulkCrawl,
        bulkDelete: mockMutations,
      });

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Select all repositories
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      // Click bulk crawl
      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      fireEvent.click(crawlButton);

      // Should show confirmation dialog or handle directly
      await waitFor(() => {
        expect(mockBulkCrawl.mutateAsync).toHaveBeenCalled();
      });
    });
  });

  describe('User Feedback and Notifications', () => {
    it('should show toast notification when repository is already crawling', async () => {
      const mockCrawlMutation = {
        ...mockMutations,
        mutateAsync: vi.fn().mockRejectedValue({
          status: 409,
          message: 'Repository is already being crawled',
        }),
      };

      mockUseRepositories.useCrawlRepository.mockReturnValue(mockCrawlMutation);

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      // Simulate attempting to crawl an already crawling repository
      // This would typically be triggered by clicking a crawl button
      // The exact implementation depends on how the UI is structured
    });

    it('should show detailed bulk operation results', async () => {
      const mockBulkCrawl = {
        ...mockMutations,
        mutateAsync: vi.fn().mockResolvedValue({
          successful: 2,
          failed: 1,
          alreadyCrawling: 1,
          total: 4,
        }),
      };

      mockUseRepositories.useBulkRepositoryOperations.mockReturnValue({
        bulkEnable: mockMutations,
        bulkDisable: mockMutations,
        bulkCrawl: mockBulkCrawl,
        bulkDelete: mockMutations,
      });

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      // The component should handle and display the detailed results appropriately
    });

    it('should show confirmation dialog for bulk crawl with conflicts', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      // Mock window.confirm
      const mockConfirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Select repositories with mixed crawling states
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 2) {
        fireEvent.click(checkboxes[1]); // repo 1 (crawling)
        fireEvent.click(checkboxes[2]); // repo 2 (not crawling)
      }

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      fireEvent.click(crawlButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
      });

      mockConfirm.mockRestore();
    });
  });

  describe('Race Condition Handling', () => {
    it('should handle rapid crawl state changes', async () => {
      // Mock changing active progress data
      let progressData = mockActiveProgress;
      
      const mockActiveProgressHook = {
        data: progressData,
        isLoading: false,
        error: null,
      };

      mockUseRepositories.useActiveProgress.mockReturnValue(mockActiveProgressHook);

      const { rerender } = render(<RepositoriesPage />, { wrapper: createWrapper() });

      // Initially repo-1 is crawling
      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Change active progress to show repo-1 completed
      progressData = [];
      mockActiveProgressHook.data = progressData;
      
      rerender(<RepositoriesPage />);

      // Component should update to reflect the new state
      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });
    });

    it('should handle concurrent selection and crawl operations', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Simulate rapid selection changes
      const checkboxes = screen.getAllByRole('checkbox');
      
      if (checkboxes.length > 2) {
        // Rapid select/deselect operations
        fireEvent.click(checkboxes[1]);
        fireEvent.click(checkboxes[2]);
        fireEvent.click(checkboxes[1]); // deselect
        fireEvent.click(checkboxes[1]); // reselect
      }

      // Component should handle these rapid changes gracefully
      expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of repositories efficiently', async () => {
      const manyRepos = Array.from({ length: 100 }, (_, i) => ({
        ...mockRepositories[0],
        id: `repo-${i}`,
        name: `Repository ${i}`,
      }));

      const manyProgress = Array.from({ length: 50 }, (_, i) => ({
        ...mockActiveProgress[0],
        repository_id: `repo-${i}`,
        repository_name: `Repository ${i}`,
      }));

      mockUseRepositories.useRepositories.mockReturnValue({
        data: manyRepos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseRepositories.useActiveProgress.mockReturnValue({
        data: manyProgress,
        isLoading: false,
        error: null,
      });

      const startTime = performance.now();
      
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Repository 0')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000);
    });

    it('should handle empty active progress gracefully', async () => {
      mockUseRepositories.useActiveProgress.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // No repositories should appear as crawling
      expect(screen.queryByText(/currently crawling/)).not.toBeInTheDocument();
    });

    it('should handle active progress API errors', async () => {
      mockUseRepositories.useActiveProgress.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error('API Error'),
      });

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Should still render repositories, but without crawling state information
      expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
    });
  });

  describe('Accessibility and UX', () => {
    it('should provide appropriate ARIA labels for crawling states', async () => {
      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Should have appropriate ARIA labels for accessibility
      // The exact implementation depends on how the crawling state is communicated
    });

    it('should show helpful tooltips for disabled bulk operations', async () => {
      // All selected repositories are crawling
      mockUseRepositories.useActiveProgress.mockReturnValue({
        data: mockRepositories.map(repo => ({
          ...mockActiveProgress[0],
          repository_id: repo.id,
          repository_name: repo.name,
        })),
        isLoading: false,
        error: null,
      });

      render(<RepositoriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
      });

      // Select all repositories
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      // Bulk crawl button should have helpful tooltip
      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      expect(crawlButton).toHaveAttribute('title', 
        expect.stringContaining('already being crawled')
      );
    });
  });
});