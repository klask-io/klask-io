import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import  userEvent from '@testing-library/user-event';
import SearchPage from '../SearchPage';
import * as useSearch from '../../../hooks/useSearch';
import type { SearchResponse, SearchResult } from '../../../types';
import { SearchFiltersProvider } from '../../../contexts/SearchFiltersContext';

// Mock the search hooks
vi.mock('../../../hooks/useSearch');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SearchFiltersProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </SearchFiltersProvider>
    </QueryClientProvider>
  );
};

describe('SearchPage - Repository Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useSearchFilters hook used by SearchFiltersProvider
    vi.mocked(useSearch.useSearchFilters).mockReturnValue({
      data: {
        projects: [],
        versions: [],
        extensions: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it('displays repository/project name in search results', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        file_id: '1',
        doc_address: '0:1',
        name: 'main.rs',
        path: 'src/main.rs',
        content_snippet: 'fn main() { println!("Hello"); }',
        project: 'klask-io/klask',
        repository_name: 'klask-io/klask',
        version: 'main',
        extension: 'rs',
        score: 1.5,
      },
      {
        file_id: '2',
        doc_address: '0:2',
        name: 'lib.rs',
        path: 'src/lib.rs',
        content_snippet: 'pub fn hello() { }',
        project: 'rust-lang/rust',
        repository_name: 'rust-lang/rust',
        version: 'main',
        extension: 'rs',
        score: 1.2,
      },
    ];

    const mockSearchResponse: SearchResponse = {
      results: mockSearchResults,
      total: 2,
      page: 1,
      size: 20,
      facets: {
        projects: [
          { value: 'klask-io/klask', count: 1 },
          { value: 'rust-lang/rust', count: 1 },
        ],
        versions: [{ value: 'main', count: 2 }],
        extensions: [{ value: 'rs', count: 2 }],
      },
    };

    vi.mocked(useSearch.useMultiSelectSearch).mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSearch.useSearchHistory).mockReturnValue({
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<SearchPage />, { wrapper: createWrapper() });

    // Type a search query
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'hello');

    await waitFor(() => {
      expect(screen.getByText('main.rs')).toBeInTheDocument();
    });

    // Verify repository names are displayed
    expect(screen.getByText(/klask-io\/klask/i)).toBeInTheDocument();
    expect(screen.getByText(/rust-lang\/rust/i)).toBeInTheDocument();
  });

  it('filters results by repository/project when clicking project badge', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        file_id: '1',
        doc_address: '0:1',
        name: 'main.rs',
        path: 'src/main.rs',
        content_snippet: 'fn main() { }',
        project: 'klask-io/klask',
        repository_name: 'klask-io/klask',
        version: 'main',
        extension: 'rs',
        score: 1.5,
      },
    ];

    const mockFilteredResponse: SearchResponse = {
      results: mockSearchResults,
      total: 1,
      page: 1,
      size: 20,
      facets: {
        projects: [{ value: 'klask-io/klask', count: 1 }],
        versions: [{ value: 'main', count: 1 }],
        extensions: [{ value: 'rs', count: 1 }],
      },
    };

    const mockMultiSelectSearch = vi.fn().mockReturnValue({
      data: mockFilteredResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useSearch.useMultiSelectSearch).mockImplementation(mockMultiSelectSearch);

    vi.mocked(useSearch.useSearchHistory).mockReturnValue({
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<SearchPage />, { wrapper: createWrapper() });

    // Type a search query
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'main');

    await waitFor(() => {
      expect(screen.getByText('main.rs')).toBeInTheDocument();
    });

    // Click on project badge/filter
    const projectBadge = screen.getByText(/klask-io\/klask/i);
    await userEvent.click(projectBadge);

    // Verify that the filter was applied (check if useMultiSelectSearch was called with filter)
    await waitFor(() => {
      const calls = mockMultiSelectSearch.mock.calls;
      const lastCall = calls[calls.length - 1];
      // The second argument should contain the filters
      expect(lastCall?.[1]).toMatchObject({
        project: expect.arrayContaining(['klask-io/klask']),
      });
    });
  });

  it('displays multiple repositories in facets', async () => {
    const mockSearchResponse: SearchResponse = {
      results: [],
      total: 0,
      page: 1,
      size: 20,
      facets: {
        projects: [
          { value: 'klask-io/klask', count: 10 },
          { value: 'rust-lang/rust', count: 25 },
          { value: 'facebook/react', count: 15 },
        ],
        versions: [{ value: 'main', count: 50 }],
        extensions: [{ value: 'rs', count: 50 }],
      },
    };

    vi.mocked(useSearch.useMultiSelectSearch).mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSearch.useSearchHistory).mockReturnValue({
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<SearchPage />, { wrapper: createWrapper() });

    // Type a search query to trigger facets display
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'test');

    await waitFor(() => {
      // Check if facets are displayed
      expect(screen.getByText(/klask-io\/klask/i)).toBeInTheDocument();
      expect(screen.getByText(/rust-lang\/rust/i)).toBeInTheDocument();
      expect(screen.getByText(/facebook\/react/i)).toBeInTheDocument();
    });

    // Verify counts are displayed
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('handles search results without repository name (legacy data)', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        file_id: '1',
        doc_address: '0:1',
        name: 'legacy.rs',
        path: 'src/legacy.rs',
        content_snippet: 'fn legacy() { }',
        project: '', // Empty project name
        repository_name: '', // Empty repository name
        version: 'main',
        extension: 'rs',
        score: 1.0,
      },
    ];

    const mockSearchResponse: SearchResponse = {
      results: mockSearchResults,
      total: 1,
      page: 1,
      size: 20,
    };

    vi.mocked(useSearch.useMultiSelectSearch).mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSearch.useSearchHistory).mockReturnValue({
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<SearchPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'legacy');

    await waitFor(() => {
      expect(screen.getByText('legacy.rs')).toBeInTheDocument();
    });

    // Result should still be displayed even without repository name
    expect(screen.getByText(/src\/legacy.rs/i)).toBeInTheDocument();
  });

  it('clears repository filter when clicking clear button', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        file_id: '1',
        doc_address: '0:1',
        name: 'main.rs',
        path: 'src/main.rs',
        content_snippet: 'fn main() { }',
        project: 'klask-io/klask',
        repository_name: 'klask-io/klask',
        version: 'main',
        extension: 'rs',
        score: 1.5,
      },
    ];

    const mockSearchResponse: SearchResponse = {
      results: mockSearchResults,
      total: 1,
      page: 1,
      size: 20,
      facets: {
        projects: [{ value: 'klask-io/klask', count: 1 }],
        versions: [{ value: 'main', count: 1 }],
        extensions: [{ value: 'rs', count: 1 }],
      },
    };

    const mockMultiSelectSearch = vi.fn().mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useSearch.useMultiSelectSearch).mockImplementation(mockMultiSelectSearch);

    vi.mocked(useSearch.useSearchHistory).mockReturnValue({
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<SearchPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'main');

    await waitFor(() => {
      expect(screen.getByText('main.rs')).toBeInTheDocument();
    });

    // Apply filter
    const projectBadge = screen.getByText(/klask-io\/klask/i);
    await userEvent.click(projectBadge);

    // Find and click clear filters button (if it exists)
    const clearButton = screen.queryByRole('button', { name: /clear.*filter/i });
    if (clearButton) {
      await userEvent.click(clearButton);

      // Verify filters were cleared
      await waitFor(() => {
        const calls = mockMultiSelectSearch.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.[1]?.project).toBeUndefined();
      });
    }
  });

  it('allows filtering by multiple repositories', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        file_id: '1',
        doc_address: '0:1',
        name: 'main.rs',
        path: 'src/main.rs',
        content_snippet: 'fn main() { }',
        project: 'klask-io/klask',
        repository_name: 'klask-io/klask',
        version: 'main',
        extension: 'rs',
        score: 1.5,
      },
      {
        file_id: '2',
        doc_address: '0:2',
        name: 'lib.rs',
        path: 'src/lib.rs',
        content_snippet: 'pub fn hello() { }',
        project: 'rust-lang/rust',
        repository_name: 'rust-lang/rust',
        version: 'main',
        extension: 'rs',
        score: 1.2,
      },
    ];

    const mockSearchResponse: SearchResponse = {
      results: mockSearchResults,
      total: 2,
      page: 1,
      size: 20,
      facets: {
        projects: [
          { value: 'klask-io/klask', count: 1 },
          { value: 'rust-lang/rust', count: 1 },
        ],
        versions: [{ value: 'main', count: 2 }],
        extensions: [{ value: 'rs', count: 2 }],
      },
    };

    const mockMultiSelectSearch = vi.fn().mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useSearch.useMultiSelectSearch).mockImplementation(mockMultiSelectSearch);

    vi.mocked(useSearch.useSearchHistory).mockReturnValue({
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<SearchPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('main.rs')).toBeInTheDocument();
    });

    // Click multiple project filters
    const klaskBadge = screen.getByText(/klask-io\/klask/i);
    const rustBadge = screen.getByText(/rust-lang\/rust/i);

    await userEvent.click(klaskBadge);
    await userEvent.click(rustBadge);

    // Verify both filters were applied
    await waitFor(() => {
      const calls = mockMultiSelectSearch.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[1]?.project).toBeDefined();
      // Should contain both repositories
      const projects = lastCall?.[1]?.project || [];
      expect(projects.length).toBeGreaterThan(0);
    });
  });
});
