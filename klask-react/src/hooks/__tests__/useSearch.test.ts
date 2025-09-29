import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useSearch,
  useAdvancedSearch,
  useSearchHistory,
  useSearchFilters,
  useInfiniteSearch,
  useSearchSuggestions,
} from '../useSearch';
import { apiClient } from '../../lib/api';

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    search: vi.fn(),
    getSearchFilters: vi.fn(),
  },
}));

const mockApiClient = apiClient as any;

describe('useSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  describe('useSearch hook', () => {
    it('should fetch search results when query is provided', async () => {
      const mockResults = {
        results: [
          { id: '1', title: 'Test Result', content: 'Test content' },
        ],
        total: 1,
      };

      mockApiClient.search.mockResolvedValue(mockResults);

      const { result } = renderHook(
        () => useSearch({ query: 'test query' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResults);
      expect(mockApiClient.search).toHaveBeenCalledWith({ query: 'test query' });
    });

    it('should not fetch when query is empty', () => {
      renderHook(
        () => useSearch({ query: '' }),
        { wrapper }
      );

      expect(mockApiClient.search).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      mockApiClient.search.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useSearch({ query: 'test query' }),
        { wrapper }
      );

      // First wait for the query to be triggered
      await waitFor(() => {
        expect(result.current.isLoading || result.current.isError).toBe(true);
      }, { timeout: 1000 });

      // Then wait for the error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 2000 });

      expect(result.current.error).toBeTruthy();
    });

    it('should not retry on 4xx errors', async () => {
      const mockError = { status: 400 };
      mockApiClient.search.mockRejectedValue(mockError);

      renderHook(
        () => useSearch({ query: 'test query' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockApiClient.search).toHaveBeenCalledTimes(1);
      });
    });

    it('should respect enabled option', () => {
      renderHook(
        () => useSearch({ query: 'test query' }, { enabled: false }),
        { wrapper }
      );

      expect(mockApiClient.search).not.toHaveBeenCalled();
    });
  });

  describe('useAdvancedSearch hook', () => {
    it('should handle search with filters', async () => {
      const mockResults = {
        pages: [
          {
            results: [
              { id: '1', title: 'Filtered Result', content: 'Content' },
            ],
            total: 1,
          },
        ],
      };

      mockApiClient.search.mockResolvedValue({
        results: mockResults.pages[0].results,
        total: mockResults.pages[0].total,
      });

      const { result } = renderHook(
        () => useAdvancedSearch('test', { project: 'my-project', extension: 'js' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });

      expect(result.current.totalResults).toBe(1);
      expect(mockApiClient.search).toHaveBeenCalledWith({
        query: 'test',
        project: 'my-project',
        extension: 'js',
        version: undefined,
        maxResults: 20,
        offset: 0,
      });
    });

    it('should flatten infinite query results', async () => {
      const mockPage1 = {
        results: [{ id: '1', title: 'Result 1' }],
        total: 3,
      };
      const mockPage2 = {
        results: [{ id: '2', title: 'Result 2' }, { id: '3', title: 'Result 3' }],
        total: 3,
      };

      mockApiClient.search
        .mockResolvedValueOnce(mockPage1)
        .mockResolvedValueOnce(mockPage2);

      const { result } = renderHook(
        () => useAdvancedSearch('test'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });

      // Simulate fetching next page
      act(() => {
        result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(3);
      });

      expect(result.current.totalResults).toBe(3);
      expect(result.current.hasNextPage).toBe(false);
    });

    it('should handle empty query', () => {
      const { result } = renderHook(
        () => useAdvancedSearch(''),
        { wrapper }
      );

      expect(result.current.results).toEqual([]);
      expect(mockApiClient.search).not.toHaveBeenCalled();
    });
  });

  describe('useInfiniteSearch hook', () => {
    it('should handle pagination correctly', async () => {
      const mockPage1 = { results: [{ id: '1' }], total: 2 };
      const mockPage2 = { results: [{ id: '2' }], total: 2 };

      mockApiClient.search
        .mockResolvedValueOnce(mockPage1)
        .mockResolvedValueOnce(mockPage2);

      const { result } = renderHook(
        () => useInfiniteSearch({ query: 'test' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(1);
      });

      expect(result.current.hasNextPage).toBe(true);

      act(() => {
        result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it('should calculate next page param correctly', async () => {
      const mockResults = { results: new Array(20).fill({ id: 'test' }), total: 50 };
      mockApiClient.search.mockResolvedValue(mockResults);

      const { result } = renderHook(
        () => useInfiniteSearch({ query: 'test' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.hasNextPage).toBe(true);
      });

      expect(mockApiClient.search).toHaveBeenCalledWith({
        query: 'test',
        maxResults: 20,
        offset: 0,
      });
    });
  });

  describe('useSearchFilters hook', () => {
    it('should fetch search filters', async () => {
      const mockFilters = {
        projects: ['project1', 'project2'],
        versions: ['1.0.0', '2.0.0'],
        extensions: ['js', 'ts', 'py'],
      };

      const expectedFilters = {
        projects: [
          { value: 'project1', label: 'project1', count: 0 },
          { value: 'project2', label: 'project2', count: 0 },
        ],
        versions: [
          { value: '1.0.0', label: '1.0.0', count: 0 },
          { value: '2.0.0', label: '2.0.0', count: 0 },
        ],
        extensions: [
          { value: 'js', label: 'js', count: 0 },
          { value: 'ts', label: 'ts', count: 0 },
          { value: 'py', label: 'py', count: 0 },
        ],
        languages: [],
      };

      mockApiClient.getSearchFilters.mockResolvedValue(mockFilters);

      const { result } = renderHook(() => useSearchFilters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(expectedFilters);
      expect(mockApiClient.getSearchFilters).toHaveBeenCalledTimes(1);
    });

    it('should cache filters for 5 minutes', async () => {
      const mockFilters = { projects: [], versions: [], extensions: [] };
      mockApiClient.getSearchFilters.mockResolvedValue(mockFilters);

      const { result, rerender } = renderHook(() => useSearchFilters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Rerender should not trigger new API call due to caching
      rerender();
      expect(mockApiClient.getSearchFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSearchSuggestions hook', () => {
    it('should not fetch for short queries', () => {
      renderHook(() => useSearchSuggestions('a'), { wrapper });
      expect(mockApiClient.search).not.toHaveBeenCalled();
    });

    it('should return empty suggestions for now', async () => {
      const { result } = renderHook(
        () => useSearchSuggestions('test query'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should respect enabled option', () => {
      renderHook(
        () => useSearchSuggestions('test query', { enabled: false }),
        { wrapper }
      );

      expect(mockApiClient.search).not.toHaveBeenCalled();
    });
  });
});

describe('useSearchHistory hook', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>,
    setItem: ReturnType<typeof vi.fn>,
    removeItem: ReturnType<typeof vi.fn>,
    clear: ReturnType<typeof vi.fn>
  };

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorageMock);
    vi.clearAllMocks();
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toEqual([]);
  });

  it('should load history from localStorage', () => {
    const mockHistory = ['query1', 'query2'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));

    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toEqual(mockHistory);
  });

  it('should handle localStorage parse errors', () => {
    localStorageMock.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toEqual([]);
  });

  it('should add queries to history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('new query');
    });

    expect(result.current.history).toEqual(['new query']);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'klask-search-history',
      JSON.stringify(['new query'])
    );
  });

  it('should move existing query to front', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('query1');
      result.current.addToHistory('query2');
      result.current.addToHistory('query1'); // This should move to front
    });

    expect(result.current.history).toEqual(['query1', 'query2']);
  });

  it('should limit history to 10 items', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      for (let i = 1; i <= 12; i++) {
        result.current.addToHistory(`query${i}`);
      }
    });

    expect(result.current.history).toHaveLength(10);
    expect(result.current.history[0]).toBe('query12');
    expect(result.current.history[9]).toBe('query3');
  });

  it('should not add empty queries', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('');
      result.current.addToHistory('   ');
    });

    expect(result.current.history).toEqual([]);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('query1');
      result.current.addToHistory('query2');
    });

    expect(result.current.history).toHaveLength(2);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('klask-search-history');
  });

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('test query');
    });

    // Should still update state even if localStorage fails
    expect(result.current.history).toEqual(['test query']);
  });

  it('should handle localStorage clear errors gracefully', () => {
    localStorageMock.removeItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('test query');
      result.current.clearHistory();
    });

    // Should still clear state even if localStorage fails
    expect(result.current.history).toEqual([]);
  });
});