import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FileDetailPage from '../FileDetailPage';
import { apiClient } from '../../../lib/api';
import type { File, SearchResult } from '../../../types';

// Mock the API client
vi.mock('../../../lib/api', () => ({
  apiClient: {
    getFile: vi.fn(),
    getFileByDocAddress: vi.fn(),
  },
  getErrorMessage: vi.fn((error) => error?.message || 'Unknown error'),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock OptimizedSyntaxHighlighter
vi.mock('../../../components/ui/OptimizedSyntaxHighlighter', () => ({
  default: vi.fn(({ children, language, style }) => (
    <div
      data-testid="syntax-highlighter"
      data-language={language}
      data-style={style}
    >
      {children}
    </div>
  )),
}));

// Mock LoadingSpinner
vi.mock('../../../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: ({ size, className }: { size?: string; className?: string }) => (
    <div data-testid="loading-spinner" data-size={size} className={className}>
      Loading...
    </div>
  ),
}));

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ArrowLeftIcon: () => <div data-testid="arrow-left-icon" />,
  DocumentTextIcon: () => <div data-testid="document-text-icon" />,
  FolderIcon: () => <div data-testid="folder-icon" />,
  ClipboardDocumentIcon: () => <div data-testid="clipboard-icon" />,
  SunIcon: () => <div data-testid="sun-icon" />,
  MoonIcon: () => <div data-testid="moon-icon" />,
  MagnifyingGlassIcon: () => <div data-testid="search-icon" />,
  TagIcon: () => <div data-testid="tag-icon" />,
  CalendarIcon: () => <div data-testid="calendar-icon" />,
  UserIcon: () => <div data-testid="user-icon" />,
  ChevronRightIcon: () => <div data-testid="chevron-right-icon" />,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('FileDetailPage', () => {
  const mockFile: File = {
    id: 'test-file-id',
    name: 'test.js',
    path: 'src/components/test.js',
    content: 'console.log("Hello, world!");',
    project: 'test-project',
    version: 'main',
    extension: 'js',
    size: 30,
    last_modified: '2023-12-01T12:00:00Z',
    created_at: '2023-12-01T10:00:00Z',
    updated_at: '2023-12-01T12:00:00Z',
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialEntries: string[] = ['/files/test-file-id'], state?: any) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries} state={state}>
          <FileDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    vi.mocked(apiClient.getFile).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithRouter();

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading file content...')).toBeInTheDocument();
  });

  it('renders file content when loaded successfully', async () => {
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    expect(screen.getByText('src/components')).toBeInTheDocument();
    expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    expect(screen.getByText(mockFile.content!)).toBeInTheDocument();
  });

  it('renders error state when file is not found', async () => {
    vi.mocked(apiClient.getFile).mockRejectedValue(new Error('File not found'));
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('File Not Found')).toBeInTheDocument();
    });

    expect(screen.getByText('File not found')).toBeInTheDocument();
    expect(screen.getByText('Back to Search')).toBeInTheDocument();
  });

  it('handles docAddress parameter correctly', async () => {
    vi.mocked(apiClient.getFileByDocAddress).mockResolvedValue(mockFile);
    
    renderWithRouter(['/files/doc/test-doc-address']);

    await waitFor(() => {
      expect(apiClient.getFileByDocAddress).toHaveBeenCalledWith('test-doc-address');
    });
  });

  it('handles id parameter correctly', async () => {
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter(['/files/test-file-id']);

    await waitFor(() => {
      expect(apiClient.getFile).toHaveBeenCalledWith('test-file-id');
    });
  });

  it('displays file metadata correctly', async () => {
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    expect(screen.getByText('.js')).toBeInTheDocument();
    expect(screen.getByText('30.0 B')).toBeInTheDocument();
    expect(screen.getByText('test-project')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('formats file path correctly', async () => {
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('src/components')).toBeInTheDocument();
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });
  });

  it('formats file size correctly', async () => {
    const largeFile = { ...mockFile, size: 2048 };
    vi.mocked(apiClient.getFile).mockResolvedValue(largeFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    });
  });

  it('detects language from file extension', async () => {
    const OptimizedSyntaxHighlighter = await import('../../../components/ui/OptimizedSyntaxHighlighter');
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(OptimizedSyntaxHighlighter.default).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'javascript',
        }),
        expect.any(Object)
      );
    });
  });

  it('handles unknown file extensions', async () => {
    const unknownFile = { ...mockFile, extension: 'unknown' };
    const OptimizedSyntaxHighlighter = await import('../../../components/ui/OptimizedSyntaxHighlighter');
    vi.mocked(apiClient.getFile).mockResolvedValue(unknownFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(OptimizedSyntaxHighlighter.default).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'text',
        }),
        expect.any(Object)
      );
    });
  });

  it('toggles line numbers correctly', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    const lineNumbersButton = screen.getByText('Line Numbers');
    
    // Should be enabled by default
    expect(lineNumbersButton).toHaveClass('bg-blue-100');
    
    await user.click(lineNumbersButton);
    
    // Should be disabled after click
    expect(lineNumbersButton).toHaveClass('bg-gray-100');
  });

  it('toggles wrap lines correctly', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    const wrapLinesButton = screen.getByText('Wrap Lines');
    
    // Should be disabled by default
    expect(wrapLinesButton).toHaveClass('bg-gray-100');
    
    await user.click(wrapLinesButton);
    
    // Should be enabled after click
    expect(wrapLinesButton).toHaveClass('bg-blue-100');
  });

  it('toggles theme correctly', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    const themeButton = screen.getByTestId('moon-icon').parentElement!;
    await user.click(themeButton);
    
    // Should switch to dark theme
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  it('copies content to clipboard', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy Content');
    await user.click(copyButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockFile.content);
  });

  it('handles copy to clipboard errors', async () => {
    const user = userEvent.setup();
    const toast = await import('react-hot-toast');
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Copy failed'));
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy Content');
    await user.click(copyButton);
    
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to copy to clipboard');
    });
  });

  it('renders file with no content', async () => {
    const emptyFile = { ...mockFile, content: null };
    vi.mocked(apiClient.getFile).mockResolvedValue(emptyFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No content available for this file')).toBeInTheDocument();
    });
  });

  it('displays search context when available', async () => {
    const searchResult: SearchResult = {
      id: 'test-file-id',
      path: 'src/components/test.js',
      content_snippet: 'console.log',
      score: 0.85,
      line_number: 1,
      project: 'test-project',
      version: 'main',
      extension: 'js',
      file_size: 30,
      last_modified: '2023-12-01T12:00:00Z',
    };

    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={['/files/test-file-id']}
          initialState={{
            searchQuery: 'console.log',
            searchResult,
          }}
        >
          <FileDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Search Context')).toBeInTheDocument();
    });

    expect(screen.getByText(/Found in search for "console.log"/)).toBeInTheDocument();
    expect(screen.getByText(/relevance score of 85.0%/)).toBeInTheDocument();
    expect(screen.getByText(/around line 1/)).toBeInTheDocument();
  });

  it('renders navigation links correctly', async () => {
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Back to Search')).toBeInTheDocument();
    });

    const backLink = screen.getByText('Back to Search').closest('a');
    expect(backLink).toHaveAttribute('href', '/search');
  });

  it('renders search results link when search query is present', async () => {
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/files/test-file-id',
              state: { searchQuery: 'test query' },
            },
          ]}
        >
          <FileDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('"test query" results')).toBeInTheDocument();
    });
  });

  it('applies correct syntax highlighting style based on theme', async () => {
    const user = userEvent.setup();
    const OptimizedSyntaxHighlighter = await import('../../../components/ui/OptimizedSyntaxHighlighter');
    vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('test.js')).toBeInTheDocument();
    });

    // Should use light theme by default
    expect(OptimizedSyntaxHighlighter.default).toHaveBeenCalledWith(
      expect.objectContaining({
        style: 'oneLight',
      }),
      expect.any(Object)
    );

    // Toggle to dark theme
    const themeButton = screen.getByTestId('moon-icon').parentElement!;
    await user.click(themeButton);

    // Should switch to dark theme
    await waitFor(() => {
      expect(OptimizedSyntaxHighlighter.default).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'oneDark',
        }),
        expect.any(Object)
      );
    });
  });

  it('handles different file extensions correctly', async () => {
    const testCases = [
      { extension: 'py', expectedLanguage: 'python' },
      { extension: 'rs', expectedLanguage: 'rust' },
      { extension: 'ts', expectedLanguage: 'typescript' },
      { extension: 'yml', expectedLanguage: 'yaml' },
      { extension: 'md', expectedLanguage: 'markdown' },
    ];

    for (const { extension, expectedLanguage } of testCases) {
      const testFile = { ...mockFile, extension };
      const OptimizedSyntaxHighlighter = await import('../../../components/ui/OptimizedSyntaxHighlighter');
      vi.mocked(apiClient.getFile).mockResolvedValue(testFile);
      
      const { unmount } = renderWithRouter();

      await waitFor(() => {
        expect(OptimizedSyntaxHighlighter.default).toHaveBeenCalledWith(
          expect.objectContaining({
            language: expectedLanguage,
          }),
          expect.any(Object)
        );
      });

      unmount();
      vi.clearAllMocks();
    }
  });

  it('handles large file sizes correctly', async () => {
    const largeFile = { ...mockFile, size: 1073741824 }; // 1GB
    vi.mocked(apiClient.getFile).mockResolvedValue(largeFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('1.0 GB')).toBeInTheDocument();
    });
  });

  it('handles file with complex path structure', async () => {
    const complexFile = {
      ...mockFile,
      path: 'src/very/deep/nested/folder/structure/complex.component.tsx',
      name: 'complex.component.tsx',
    };
    vi.mocked(apiClient.getFile).mockResolvedValue(complexFile);
    
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('src/very/deep/nested/folder/structure')).toBeInTheDocument();
      expect(screen.getByText('complex.component.tsx')).toBeInTheDocument();
    });
  });
});