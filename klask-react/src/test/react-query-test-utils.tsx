import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, RenderHookOptions } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';

/**
 * Enhanced React Query test utilities to handle common mocking issues
 */

// Default test query client configuration with optimized settings for testing
export const createTestQueryClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: 0,
        gcTime: 0, // Previously cacheTime in v4
      },
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });
  
  // Override any specific query configurations to force no retries during testing
  client.setQueryDefaults(['users'], { retry: false, retryDelay: 0 });
  client.setQueryDefaults(['users', 'stats'], { retry: false, retryDelay: 0 });
  
  // Override for wildcard patterns to catch any user-related queries
  const originalQuery = client.defaultOptions.queries?.retry;
  client.getQueryDefaults = () => ({
    ...client.getQueryDefaults(),
    retry: false,
    retryDelay: 0,
  });
  
  return client;
};

// Query client provider wrapper for testing
export const QueryClientWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Enhanced renderHook function with QueryClient provider
export const renderHookWithQueryClient = <TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps>
) => {
  const queryClient = createTestQueryClient();
  
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const result = renderHook(callback, {
    wrapper,
    ...options,
  });

  return {
    ...result,
    queryClient, // Return the query client for direct access
  };
};

// Mock query utilities - simplified versions to avoid TypeScript parsing issues
export const createMockQuery = (data: any, options: any = {}) => ({
  data,
  isLoading: options.isLoading ?? false,
  isError: options.isError ?? false,
  error: options.error ?? null,
  isSuccess: options.isSuccess ?? true,
  isFetching: options.isFetching ?? false,
  refetch: options.refetch ?? vi.fn(),
  status: options.isLoading ? 'pending' : 
          options.isError ? 'error' : 'success',
});

export const createMockMutation = (options: any = {}) => ({
  isPending: options.isPending ?? false,
  isError: options.isError ?? false,
  isSuccess: options.isSuccess ?? false,
  error: options.error ?? null,
  data: options.data,
  mutate: options.mutate ?? vi.fn(),
  mutateAsync: options.mutateAsync ?? vi.fn().mockResolvedValue(options.data),
  reset: options.reset ?? vi.fn(),
  status: options.isPending ? 'pending' : 
          options.isError ? 'error' :
          options.isSuccess ? 'success' : 'idle',
});

// Mock infinite query utilities
export const createMockInfiniteQuery = (pages: any[], options: any = {}) => ({
  data: pages.length > 0 ? { pages, pageParams: [] } : undefined,
  isLoading: options.isLoading ?? false,
  isError: options.isError ?? false,
  error: options.error ?? null,
  hasNextPage: options.hasNextPage ?? false,
  isFetchingNextPage: options.isFetchingNextPage ?? false,
  fetchNextPage: options.fetchNextPage ?? vi.fn(),
  status: options.isLoading ? 'pending' : 
          options.isError ? 'error' : 'success',
});

// Utility to clear all query cache between tests
export const clearQueryClientCache = (queryClient: QueryClient) => {
  queryClient.clear();
  queryClient.getQueryCache().clear();
  queryClient.getMutationCache().clear();
};

// Mock timers utility for React Query polling/refetch scenarios
export const mockTimers = () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
};

// Enhanced error mock for API failures
export const createApiError = (status: number, message: string) => {
  const error = new Error(message);
  (error as any).status = status;
  (error as any).response = {
    status,
    statusText: message,
    data: { message },
  };
  return error;
};

// Mock API client response builder
export const mockApiSuccess = (data: any, delay = 0) => {
  if (delay > 0) {
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
  }
  return Promise.resolve(data);
};

export const mockApiError = (status: number, message: string, delay = 0) => {
  const error = createApiError(status, message);
  if (delay > 0) {
    return new Promise((_, reject) => setTimeout(() => reject(error), delay));
  }
  return Promise.reject(error);
};

// Query key utilities for testing
export const createQueryKey = (...parts: (string | number | object)[]) => {
  return parts.filter(Boolean);
};

// Helper to assert query states
export const expectQueryToBeLoading = (query: any) => {
  expect(query.isLoading).toBe(true);
  expect(query.isError).toBe(false);
  expect(query.isSuccess).toBe(false);
};

export const expectQueryToBeSuccess = (query: any, data?: any) => {
  expect(query.isLoading).toBe(false);
  expect(query.isError).toBe(false);
  expect(query.isSuccess).toBe(true);
  if (data !== undefined) {
    expect(query.data).toEqual(data);
  }
};

export const expectQueryToBeError = (query: any, error?: any) => {
  expect(query.isLoading).toBe(false);
  expect(query.isError).toBe(true);
  expect(query.isSuccess).toBe(false);
  if (error !== undefined) {
    expect(query.error).toEqual(error);
  }
};

// Helper to assert mutation states
export const expectMutationToBePending = (mutation: any) => {
  expect(mutation.isPending).toBe(true);
  expect(mutation.isError).toBe(false);
  expect(mutation.isSuccess).toBe(false);
};

export const expectMutationToBeSuccess = (mutation: any, data?: any) => {
  expect(mutation.isPending).toBe(false);
  expect(mutation.isError).toBe(false);
  expect(mutation.isSuccess).toBe(true);
  if (data !== undefined) {
    expect(mutation.data).toEqual(data);
  }
};

export const expectMutationToBeError = (mutation: any, error?: any) => {
  expect(mutation.isPending).toBe(false);
  expect(mutation.isError).toBe(true);
  expect(mutation.isSuccess).toBe(false);
  if (error !== undefined) {
    expect(mutation.error).toEqual(error);
  }
};