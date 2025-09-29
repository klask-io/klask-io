import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderHookWithQueryClient } from '../../test/react-query-test-utils';
import React from 'react';
import { useStopCrawl } from '../useRepositories';
import { apiClient } from '../../lib/api';

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    stopCrawlRepository: vi.fn(),
  },
  getErrorMessage: vi.fn((error) => error?.message || 'Unknown error'),
}));

const mockApiClient = apiClient as any;

// Using renderHookWithQueryClient from test utils which handles QueryClient setup

describe('useStopCrawl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data).toBe(undefined);
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
  });

  it('should successfully stop crawl when API call succeeds', async () => {
    const repositoryId = 'repo-123';
    const mockResponse = 'Crawl stopped successfully';
    mockApiClient.stopCrawlRepository.mockResolvedValue(mockResponse);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    act(() => {
      result.current.mutate(repositoryId);
    });

    // Wait for mutation to complete (may skip pending state if very fast)
    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    }, { timeout: 1000 });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBe(mockResponse);
    expect(result.current.error).toBe(null);

    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledWith(repositoryId);
    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors correctly', async () => {
    const repositoryId = 'repo-123';
    const mockError = new Error('Failed to stop crawl');
    mockApiClient.stopCrawlRepository.mockRejectedValue(mockError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    act(() => {
      result.current.mutate(repositoryId);
    });

    // Wait for mutation to complete (may skip pending state if very fast)
    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    }, { timeout: 1000 });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
    expect(result.current.data).toBe(undefined);

    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledWith(repositoryId);
    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledTimes(1);
  });

  it('should handle network errors', async () => {
    const repositoryId = 'repo-123';
    const networkError = new Error('Network Error');
    networkError.name = 'NetworkError';
    mockApiClient.stopCrawlRepository.mockRejectedValue(networkError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(networkError);
    });
  });

  it('should handle 404 errors (repository not crawling)', async () => {
    const repositoryId = 'repo-123';
    const notFoundError = new Error('Repository not currently crawling');
    (notFoundError as any).status = 404;
    mockApiClient.stopCrawlRepository.mockRejectedValue(notFoundError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(notFoundError);
    });
  });

  it('should handle unauthorized errors', async () => {
    const repositoryId = 'repo-123';
    const unauthorizedError = new Error('Unauthorized');
    (unauthorizedError as any).status = 401;
    mockApiClient.stopCrawlRepository.mockRejectedValue(unauthorizedError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(unauthorizedError);
    });
  });

  it('should work with mutateAsync', async () => {
    const repositoryId = 'repo-123';
    const mockResponse = 'Crawl stopped successfully';
    mockApiClient.stopCrawlRepository.mockResolvedValue(mockResponse);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    let mutateAsyncResult: string | undefined;
    let mutateAsyncError: Error | undefined;

    await act(async () => {
      try {
        mutateAsyncResult = await result.current.mutateAsync(repositoryId);
      } catch (error) {
        mutateAsyncError = error as Error;
      }
    });

    expect(mutateAsyncResult).toBe(mockResponse);
    expect(mutateAsyncError).toBe(undefined);

    // Wait for state to update after mutateAsync
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBe(mockResponse);
    });
  });

  it('should reject mutateAsync on API error', async () => {
    const repositoryId = 'repo-123';
    const mockError = new Error('API Error');
    mockApiClient.stopCrawlRepository.mockRejectedValue(mockError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    let mutateAsyncError: Error | undefined;

    await act(async () => {
      try {
        await result.current.mutateAsync(repositoryId);
      } catch (error) {
        mutateAsyncError = error as Error;
      }
    });

    expect(mutateAsyncError).toBe(mockError);

    // Wait for state to update after mutateAsync error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(mockError);
    });
  });

  it('should allow multiple sequential calls', async () => {
    const repositoryId1 = 'repo-123';
    const repositoryId2 = 'repo-456';
    const mockResponse1 = 'Crawl stopped for repo 1';
    const mockResponse2 = 'Crawl stopped for repo 2';

    mockApiClient.stopCrawlRepository
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    // First call
    act(() => {
      result.current.mutate(repositoryId1);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBe(mockResponse1);
    });

    // Second call
    act(() => {
      result.current.mutate(repositoryId2);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBe(mockResponse2);
    });

    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledTimes(2);
    expect(mockApiClient.stopCrawlRepository).toHaveBeenNthCalledWith(1, repositoryId1);
    expect(mockApiClient.stopCrawlRepository).toHaveBeenNthCalledWith(2, repositoryId2);
  });

  it('should reset state between mutations', async () => {
    const repositoryId = 'repo-123';
    mockApiClient.stopCrawlRepository.mockResolvedValue('Success');

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    // First mutation
    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstCallData = result.current.data;

    // Second mutation with different response
    mockApiClient.stopCrawlRepository.mockResolvedValueOnce('Different success');
    
    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.data).not.toBe(firstCallData);
      expect(result.current.data).toBe('Different success');
    });
  });

  it('should handle concurrent mutations correctly', async () => {
    const repositoryId1 = 'repo-123';
    const repositoryId2 = 'repo-456';
    
    // Make the first call take longer
    mockApiClient.stopCrawlRepository.mockImplementation((id: string) => {
      if (id === repositoryId1) {
        return new Promise(resolve => setTimeout(() => resolve('Success 1'), 100));
      } else {
        return Promise.resolve('Success 2');
      }
    });

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    // Start both mutations nearly simultaneously
    act(() => {
      result.current.mutate(repositoryId1);
      result.current.mutate(repositoryId2);
    });

    // The second (faster) mutation should complete first
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      // The hook should have the result from the last (most recent) mutation
    });

    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledWith(repositoryId1);
    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledWith(repositoryId2);
    expect(mockApiClient.stopCrawlRepository).toHaveBeenCalledTimes(2);
  });

  it('should handle empty or invalid repository IDs', async () => {
    const invalidIds = ['', null, undefined];
    mockApiClient.stopCrawlRepository.mockRejectedValue(new Error('Invalid ID'));

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    for (const invalidId of invalidIds) {
      act(() => {
        result.current.mutate(invalidId as any);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Reset for next test
      act(() => {
        result.current.reset();
      });
    }
  });

  it('should provide reset functionality', async () => {
    const repositoryId = 'repo-123';
    const mockError = new Error('Test error');
    mockApiClient.stopCrawlRepository.mockRejectedValue(mockError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    // Trigger error
    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(mockError);
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    // Wait for reset to take effect
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.data).toBe(undefined);
    });
  });

  it('should handle timeout errors', async () => {
    const repositoryId = 'repo-123';
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'TimeoutError';
    mockApiClient.stopCrawlRepository.mockRejectedValue(timeoutError);

    const { result } = renderHookWithQueryClient(() => useStopCrawl());

    act(() => {
      result.current.mutate(repositoryId);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(timeoutError);
    });
  });

  it('should maintain referential stability of mutate function', () => {
    const { result, rerender } = renderHookWithQueryClient(() => useStopCrawl());

    const initialMutate = result.current.mutate;
    const initialMutateAsync = result.current.mutateAsync;

    rerender();

    expect(result.current.mutate).toBe(initialMutate);
    expect(result.current.mutateAsync).toBe(initialMutateAsync);
  });
});