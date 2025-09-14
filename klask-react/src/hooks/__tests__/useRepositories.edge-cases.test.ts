import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useRepositories,
  useCrawlRepository,
  useBulkRepositoryOperations,
  useActiveProgress,
} from '../useRepositories';
import { apiClient } from '../../lib/api';
import type { Repository, CrawlProgressInfo } from '../../types';

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    getRepositories: vi.fn(),
    crawlRepository: vi.fn(),
    updateRepository: vi.fn(),
    deleteRepository: vi.fn(),
    getActiveProgress: vi.fn(),
    getRepositoryProgress: vi.fn(),
  },
  getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
}));

const mockApiClient = apiClient as any;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Repository Hooks - Edge Cases & Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Network Failure Recovery', () => {
    it('should handle intermittent network failures during bulk operations', async () => {
      let failureCount = 0;
      mockApiClient.crawlRepository.mockImplementation(() => {
        failureCount++;
        if (failureCount <= 2) {
          const networkError = new Error('Network timeout');
          (networkError as any).status = 408;
          throw networkError;
        }
        return Promise.resolve('Success');
      });

      const { result } = renderHook(() => useBulkRepositoryOperations(), {
        wrapper: createWrapper(),
      });

      let bulkResult;
      await act(async () => {
        bulkResult = await result.current.bulkCrawl.mutateAsync(['repo-1', 'repo-2', 'repo-3']);
      });

      expect(bulkResult).toEqual({
        successful: 1,
        failed: 2,
        alreadyCrawling: 0,
        total: 3,
      });
    });

    it('should handle partial API responses correctly', async () => {
      // Simulate some API calls succeeding and others failing
      mockApiClient.crawlRepository
        .mockResolvedValueOnce('Success')
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce('Success');

      const { result } = renderHook(() => useBulkRepositoryOperations(), {
        wrapper: createWrapper(),
      });

      let bulkResult;
      await act(async () => {
        bulkResult = await result.current.bulkCrawl.mutateAsync(['repo-1', 'repo-2', 'repo-3']);
      });

      expect(bulkResult).toEqual({
        successful: 2,
        failed: 1,
        alreadyCrawling: 0,
        total: 3,
      });
    });

    it('should handle API timeout during active progress polling', async () => {
      vi.useFakeTimers();
      
      let timeoutCount = 0;
      mockApiClient.getActiveProgress.mockImplementation(() => {
        timeoutCount++;
        if (timeoutCount <= 2) {
          const timeoutError = new Error('Request timeout');
          (timeoutError as any).status = 408;
          throw timeoutError;
        }
        return Promise.resolve([]);
      });

      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      // Initial request fails
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Advance time to trigger retry
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Second request fails
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Third request succeeds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBeFalsy();
      });

      vi.useRealTimers();
    });
  });

  describe('Race Condition Handling', () => {
    it('should handle rapid successive crawl attempts', async () => {
      let attemptCount = 0;
      mockApiClient.crawlRepository.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.resolve('First success');
        } else {
          const conflictError = new Error('Repository is already being crawled');
          (conflictError as any).status = 409;
          throw conflictError;
        }
      });

      const { result } = renderHook(() => useCrawlRepository(), {
        wrapper: createWrapper(),
      });

      // First attempt succeeds
      await act(async () => {
        await result.current.mutateAsync('repo-1');
      });
      expect(result.current.isSuccess).toBe(true);

      // Subsequent attempts fail with conflict
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          try {
            await result.current.mutateAsync('repo-1');
          } catch (error) {
            expect((error as any).status).toBe(409);
          }
        });
      }
    });

    it('should handle concurrent bulk operations on overlapping repositories', async () => {
      const conflictError = new Error('Repository is already being crawled');
      (conflictError as any).status = 409;

      // First bulk operation - all succeed
      mockApiClient.crawlRepository
        .mockResolvedValueOnce('Success')
        .mockResolvedValueOnce('Success')
        .mockResolvedValueOnce('Success')
        // Second bulk operation - conflicts on shared repos
        .mockRejectedValueOnce(conflictError) // repo-2 (shared)
        .mockRejectedValueOnce(conflictError) // repo-3 (shared)
        .mockResolvedValueOnce('Success');     // repo-4 (new)

      const { result: result1 } = renderHook(() => useBulkRepositoryOperations(), {
        wrapper: createWrapper(),
      });
      const { result: result2 } = renderHook(() => useBulkRepositoryOperations(), {
        wrapper: createWrapper(),
      });

      // Start first bulk operation
      const promise1 = act(async () => {
        return await result1.current.bulkCrawl.mutateAsync(['repo-1', 'repo-2', 'repo-3']);
      });

      // Start second bulk operation with overlap
      const promise2 = act(async () => {
        return await result2.current.bulkCrawl.mutateAsync(['repo-2', 'repo-3', 'repo-4']);
      });

      const [result1Data, result2Data] = await Promise.all([promise1, promise2]);

      expect(result1Data).toEqual({
        successful: 3,
        failed: 0,
        alreadyCrawling: 0,
        total: 3,
      });

      expect(result2Data).toEqual({
        successful: 1,
        failed: 2,
        alreadyCrawling: 2,
        total: 3,
      });
    });

    it('should handle active progress updates during query invalidation', async () => {
      vi.useFakeTimers();

      const mockProgress1 = [{
        repository_id: 'repo-1',
        repository_name: 'Repo 1',
        status: 'processing' as const,
        progress_percentage: 50,
        files_processed: 50,
        files_total: 100,
        files_indexed: 25,
        current_file: null,
        error_message: null,
        started_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:01:00Z',
        completed_at: null,
      }];

      const mockProgress2 = [{
        ...mockProgress1[0],
        status: 'completed' as const,
        progress_percentage: 100,
        files_processed: 100,
        files_indexed: 100,
        completed_at: '2024-01-01T00:02:00Z',
      }];

      mockApiClient.getActiveProgress
        .mockResolvedValueOnce(mockProgress1)
        .mockResolvedValueOnce(mockProgress1)
        .mockResolvedValueOnce(mockProgress2)
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      // Initial load
      await waitFor(() => {
        expect(result.current.data).toEqual(mockProgress1);
      });

      // Trigger refetch
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockProgress1);
      });

      // Progress changes to completed
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockProgress2);
      });

      // Progress removed (completed crawl cleaned up)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      vi.useRealTimers();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large bulk operations efficiently', async () => {
      const largeRepositoryList = Array.from({ length: 1000 }, (_, i) => `repo-${i}`);
      
      // Mock all as successful to test performance
      mockApiClient.crawlRepository.mockImplementation(() => 
        Promise.resolve('Success')
      );

      const { result } = renderHook(() => useBulkRepositoryOperations(), {
        wrapper: createWrapper(),
      });

      const startTime = performance.now();
      
      let bulkResult;
      await act(async () => {
        bulkResult = await result.current.bulkCrawl.mutateAsync(largeRepositoryList);
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(bulkResult).toEqual({
        successful: 1000,
        failed: 0,
        alreadyCrawling: 0,
        total: 1000,
      });

      // Should complete within reasonable time (adjust threshold as needed)
      expect(executionTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle rapid mount/unmount cycles without memory leaks', async () => {
      mockApiClient.getActiveProgress.mockResolvedValue([]);

      // Simulate rapid mount/unmount
      for (let i = 0; i < 50; i++) {
        const { unmount } = renderHook(() => useActiveProgress(), {
          wrapper: createWrapper(),
        });
        
        // Unmount quickly before data loads
        unmount();
      }

      // Final mount should still work correctly
      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle extremely frequent progress updates', async () => {
      vi.useFakeTimers();

      const mockProgress = Array.from({ length: 100 }, (_, i) => ({
        repository_id: `repo-${i}`,
        repository_name: `Repo ${i}`,
        status: 'processing' as const,
        progress_percentage: i,
        files_processed: i * 10,
        files_total: 1000,
        files_indexed: i * 5,
        current_file: `file-${i}.rs`,
        error_message: null,
        started_at: '2024-01-01T00:00:00Z',
        updated_at: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`,
        completed_at: null,
      }));

      mockApiClient.getActiveProgress.mockResolvedValue(mockProgress);

      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(100);
      });

      // Rapidly advance timers to trigger many updates
      for (let i = 0; i < 50; i++) {
        act(() => {
          vi.advanceTimersByTime(100); // Faster than the 2-second refetch interval
        });
      }

      // Should still be stable
      await waitFor(() => {
        expect(result.current.data).toHaveLength(100);
      });

      vi.useRealTimers();
    });
  });

  describe('Data Consistency Edge Cases', () => {
    it('should handle malformed progress data gracefully', async () => {
      const malformedProgress = [
        // Missing required fields
        {
          repository_id: 'repo-1',
          // missing repository_name
        },
        // Invalid data types
        {
          repository_id: 'repo-2',
          repository_name: 'Repo 2',
          status: 'invalid_status',
          progress_percentage: 'not_a_number',
          files_processed: -1,
          files_total: null,
          files_indexed: 'invalid',
        },
        // Null values where not expected
        null,
        undefined,
        // Valid data
        {
          repository_id: 'repo-3',
          repository_name: 'Repo 3',
          status: 'processing',
          progress_percentage: 75,
          files_processed: 75,
          files_total: 100,
          files_indexed: 50,
          current_file: null,
          error_message: null,
          started_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:01:00Z',
          completed_at: null,
        },
      ];

      mockApiClient.getActiveProgress.mockResolvedValue(malformedProgress);

      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      // Should handle malformed data without crashing
      await waitFor(() => {
        expect(result.current.data).toEqual(malformedProgress);
      });
    });

    it('should handle API returning inconsistent data types', async () => {
      // First call returns array, second returns object, third returns string
      mockApiClient.getActiveProgress
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce({ error: 'Not an array' } as any)
        .mockResolvedValueOnce('Invalid response' as any);

      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      // Manually trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should handle the object response
      await waitFor(() => {
        expect(result.current.data).toEqual({ error: 'Not an array' });
      });

      // Manually trigger another refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should handle the string response
      await waitFor(() => {
        expect(result.current.data).toEqual('Invalid response');
      });
    });

    it('should handle repository ID format inconsistencies', async () => {
      const repositoryIds = [
        'uuid-format-id',
        '12345', // numeric string
        '', // empty string
        null as any, // null
        undefined as any, // undefined
        { id: 'object-id' } as any, // object
      ];

      mockApiClient.crawlRepository.mockImplementation((id) => {
        if (typeof id === 'string' && id.length > 0) {
          return Promise.resolve('Success');
        } else {
          const error = new Error('Invalid repository ID');
          (error as any).status = 400;
          throw error;
        }
      });

      const { result } = renderHook(() => useBulkRepositoryOperations(), {
        wrapper: createWrapper(),
      });

      let bulkResult;
      await act(async () => {
        bulkResult = await result.current.bulkCrawl.mutateAsync(repositoryIds);
      });

      expect(bulkResult).toEqual({
        successful: 2, // 'uuid-format-id' and '12345'
        failed: 4, // empty string, null, undefined, object
        alreadyCrawling: 0,
        total: 6,
      });
    });
  });

  describe('State Management Edge Cases', () => {
    it('should handle query invalidation during concurrent mutations', async () => {
      mockApiClient.crawlRepository.mockResolvedValue('Success');
      mockApiClient.getRepositories.mockResolvedValue([]);

      const { result: crawlResult } = renderHook(() => useCrawlRepository(), {
        wrapper: createWrapper(),
      });
      
      const { result: reposResult } = renderHook(() => useRepositories(), {
        wrapper: createWrapper(),
      });

      // Start multiple crawl operations simultaneously
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          act(async () => {
            await crawlResult.current.mutateAsync(`repo-${i}`);
          })
        );
      }

      await Promise.all(promises);

      // All should succeed
      expect(crawlResult.current.isSuccess).toBe(true);
      
      // Repositories query should have been invalidated
      await waitFor(() => {
        expect(reposResult.current.isLoading).toBe(false);
      });
    });

    it('should handle stale closure issues with rapid state updates', async () => {
      mockApiClient.crawlRepository.mockResolvedValue('Success');
      
      const { result } = renderHook(() => useCrawlRepository(), {
        wrapper: createWrapper(),
      });

      // Rapidly trigger multiple mutations
      const rapidMutations = [];
      for (let i = 0; i < 10; i++) {
        rapidMutations.push(
          act(async () => {
            return result.current.mutateAsync(`repo-${i}`);
          })
        );
      }

      // All mutations should complete successfully
      const results = await Promise.allSettled(rapidMutations);
      const successes = results.filter(r => r.status === 'fulfilled');
      
      expect(successes).toHaveLength(10);
    });

    it('should handle component unmount during pending operations', async () => {
      let resolvePromise: (value: string) => void;
      mockApiClient.crawlRepository.mockImplementation(() => 
        new Promise(resolve => {
          resolvePromise = resolve;
        })
      );

      const { result, unmount } = renderHook(() => useCrawlRepository(), {
        wrapper: createWrapper(),
      });

      // Start an operation
      const mutationPromise = act(async () => {
        return result.current.mutateAsync('repo-1');
      });

      // Unmount before operation completes
      unmount();

      // Resolve the promise after unmount
      resolvePromise!('Success');

      // Should handle gracefully without errors
      await expect(mutationPromise).resolves.toBe('Success');
    });
  });

  describe('Error Boundary Integration', () => {
    it('should handle errors that might cause React error boundaries to trigger', async () => {
      // Mock API to throw non-standard error
      mockApiClient.crawlRepository.mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      const { result } = renderHook(() => useCrawlRepository(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync('repo-1');
        } catch (error) {
          expect(error.message).toBe('Synchronous error');
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it('should recover gracefully from temporary API unavailability', async () => {
      let callCount = 0;
      mockApiClient.getActiveProgress.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          const error = new Error('Service unavailable');
          (error as any).status = 503;
          throw error;
        }
        return Promise.resolve([]);
      });

      const { result } = renderHook(() => useActiveProgress(), {
        wrapper: createWrapper(),
      });

      // Initial calls fail
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Manual retry should eventually succeed
      await act(async () => {
        await result.current.refetch();
      });

      await act(async () => {
        await result.current.refetch();
      });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBeFalsy();
      });
    });
  });
});