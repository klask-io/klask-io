import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FileDetailPage from '../FileDetailPage';
import { apiClient } from '../../../lib/api';
import type { File, SearchResult } from '../../../types';

// Mock all external dependencies
vi.mock('../../../lib/api', () => ({
  apiClient: {
    getFile: vi.fn(),
    getFileByDocAddress: vi.fn(),
  },
  getErrorMessage: vi.fn((error) => error?.message || 'Unknown error'),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../components/ui/OptimizedSyntaxHighlighter', () => ({
  default: vi.fn(({ children, language, style, showLineNumbers, wrapLines, customStyle }) => (
    <div
      data-testid="syntax-highlighter"
      data-language={language}
      data-style={style}
      data-line-numbers={showLineNumbers}
      data-wrap-lines={wrapLines}
      style={customStyle}
    >
      <pre>{children}</pre>
    </div>
  )),
}));

vi.mock('../../../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: ({ size, className }: { size?: string; className?: string }) => (
    <div data-testid="loading-spinner" data-size={size} className={className}>
      Loading...
    </div>
  ),
}));

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

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('File Preview Integration Tests', () => {
  let queryClient: QueryClient;

  const createMockFile = (overrides: Partial<File> = {}): File => ({
    id: 'test-file-id',
    name: 'example.js',
    path: 'src/components/example.js',
    content: 'console.log("Hello, world!");',
    project: 'test-project',
    version: 'main',
    extension: 'js',
    size: 30,
    last_modified: '2023-12-01T12:00:00Z',
    created_at: '2023-12-01T10:00:00Z',
    updated_at: '2023-12-01T12:00:00Z',
    ...overrides,
  });

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

  const renderFileDetailPage = (
    initialEntries: string[] = ['/files/test-file-id'],
    locationState?: any
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <FileDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Complete File Preview Workflow', () => {
    it('loads and displays a JavaScript file with full functionality', async () => {
      const user = userEvent.setup();
      const mockFile = createMockFile({
        content: `
// JavaScript Example
function fibonacci(n) {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log('Fibonacci(10) =', result);
        `.trim(),
        size: 200,
      });

      vi.mocked(apiClient.getFile).mockResolvedValue(mockFile);
      
      renderFileDetailPage();

      // Initial loading state
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Wait for file to load
      await waitFor(() => {
        expect(screen.getByText('example.js')).toBeInTheDocument();
      });

      // Verify file metadata
      expect(screen.getByText('src/components')).toBeInTheDocument();
      expect(screen.getByText('.js')).toBeInTheDocument();
      expect(screen.getByText('200.0 B')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();

      // Verify syntax highlighter is rendered with correct props
      const syntaxHighlighter = screen.getByTestId('syntax-highlighter');
      expect(syntaxHighlighter).toHaveAttribute('data-language', 'javascript');
      expect(syntaxHighlighter).toHaveAttribute('data-style', 'oneLight');
      expect(syntaxHighlighter).toHaveAttribute('data-line-numbers', 'true');
      expect(syntaxHighlighter).toHaveAttribute('data-wrap-lines', 'false');

      // Test line numbers toggle
      const lineNumbersButton = screen.getByText('Line Numbers');
      await user.click(lineNumbersButton);
      
      await waitFor(() => {
        expect(syntaxHighlighter).toHaveAttribute('data-line-numbers', 'false');
      });

      // Test wrap lines toggle
      const wrapLinesButton = screen.getByText('Wrap Lines');
      await user.click(wrapLinesButton);
      
      await waitFor(() => {
        expect(syntaxHighlighter).toHaveAttribute('data-wrap-lines', 'true');
      });

      // Test theme toggle
      const themeButton = screen.getByTestId('moon-icon').parentElement!;
      await user.click(themeButton);
      
      await waitFor(() => {
        expect(syntaxHighlighter).toHaveAttribute('data-style', 'oneDark');
        expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
      });

      // Test copy functionality
      const copyButton = screen.getByText('Copy Content');
      await user.click(copyButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockFile.content);
    });

    it('handles different file types correctly', async () => {
      const testFiles = [
        {
          file: createMockFile({
            name: 'Component.tsx',
            path: 'src/Component.tsx',
            extension: 'tsx',
            content: 'interface Props { name: string; }',
          }),
          expectedLanguage: 'tsx',
        },
        {
          file: createMockFile({
            name: 'main.rs',
            path: 'src/main.rs',
            extension: 'rs',
            content: 'fn main() { println!("Hello Rust"); }',
          }),
          expectedLanguage: 'rust',
        },
        {
          file: createMockFile({
            name: 'config.yml',
            path: 'config.yml',
            extension: 'yml',
            content: 'name: test\nversion: 1.0',
          }),
          expectedLanguage: 'yaml',
        },
        {
          file: createMockFile({
            name: 'README.md',
            path: 'README.md',
            extension: 'md',
            content: '# Project Title\n\nThis is a test project.',
          }),
          expectedLanguage: 'markdown',
        },
      ];

      for (const { file, expectedLanguage } of testFiles) {
        vi.mocked(apiClient.getFile).mockResolvedValue(file);
        
        const { unmount } = renderFileDetailPage([`/files/${file.id}`]);

        await waitFor(() => {
          expect(screen.getByText(file.name)).toBeInTheDocument();
        });

        const syntaxHighlighter = screen.getByTestId('syntax-highlighter');
        expect(syntaxHighlighter).toHaveAttribute('data-language', expectedLanguage);
        expect(syntaxHighlighter).toHaveTextContent(file.content!);

        unmount();
        vi.clearAllMocks();
      }
    });

    it('handles large files correctly', async () => {
      const largeContent = 'line of code\n'.repeat(5000); // Large file
      const largeFile = createMockFile({
        name: 'large.js',
        content: largeContent,
        size: largeContent.length,
      });

      vi.mocked(apiClient.getFile).mockResolvedValue(largeFile);
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('large.js')).toBeInTheDocument();
      });

      // Should still render syntax highlighter for large files
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
      expect(screen.getByText(/49\.8 KB/)).toBeInTheDocument(); // File size display
    });

    it('handles files with no content', async () => {
      const emptyFile = createMockFile({
        name: 'empty.txt',
        content: null,
        size: 0,
      });

      vi.mocked(apiClient.getFile).mockResolvedValue(emptyFile);
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('empty.txt')).toBeInTheDocument();
      });

      expect(screen.getByText('No content available for this file')).toBeInTheDocument();
      expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument();
    });
  });

  describe('Search Context Integration', () => {
    it('displays search context when navigating from search results', async () => {
      const mockFile = createMockFile();
      const searchResult: SearchResult = {
        id: 'test-file-id',
        path: 'src/components/example.js',
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
            initialEntries={[
              {
                pathname: '/files/test-file-id',
                state: {
                  searchQuery: 'console.log',
                  searchResult,
                  searchState: { query: 'console.log', filters: {} },
                },
              },
            ]}
          >
            <FileDetailPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('example.js')).toBeInTheDocument();
      });

      // Verify search context section
      expect(screen.getByText('Search Context')).toBeInTheDocument();
      expect(screen.getByText(/Found in search for "console.log"/)).toBeInTheDocument();
      expect(screen.getByText(/relevance score of 85.0%/)).toBeInTheDocument();
      expect(screen.getByText(/around line 1/)).toBeInTheDocument();

      // Verify navigation links
      expect(screen.getByText('"console.log" results')).toBeInTheDocument();
    });

    it('handles search results without line numbers', async () => {
      const mockFile = createMockFile();
      const searchResult: SearchResult = {
        id: 'test-file-id',
        path: 'src/components/example.js',
        content_snippet: 'console.log',
        score: 0.75,
        line_number: null, // No line number
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
            initialEntries={[
              {
                pathname: '/files/test-file-id',
                state: {
                  searchQuery: 'console.log',
                  searchResult,
                },
              },
            ]}
          >
            <FileDetailPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Search Context')).toBeInTheDocument();
      });

      expect(screen.getByText(/relevance score of 75.0%/)).toBeInTheDocument();
      expect(screen.queryByText(/around line/)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('handles file not found errors gracefully', async () => {
      vi.mocked(apiClient.getFile).mockRejectedValue(new Error('File not found'));
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('File Not Found')).toBeInTheDocument();
      });

      expect(screen.getByText('File not found')).toBeInTheDocument();
      expect(screen.getByText('Back to Search')).toBeInTheDocument();
    });

    it('handles network errors gracefully', async () => {
      vi.mocked(apiClient.getFile).mockRejectedValue(new Error('Network error'));
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('File Not Found')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('handles clipboard copy failures', async () => {
      const user = userEvent.setup();
      const toast = await import('react-hot-toast');
      
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Clipboard error'));
      vi.mocked(apiClient.getFile).mockResolvedValue(createMockFile());
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('example.js')).toBeInTheDocument();
      });

      const copyButton = screen.getByText('Copy Content');
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Failed to copy to clipboard');
      });
    });
  });

  describe('Navigation Integration', () => {
    it('provides correct navigation back to search', async () => {
      vi.mocked(apiClient.getFile).mockResolvedValue(createMockFile());
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('example.js')).toBeInTheDocument();
      });

      const backLink = screen.getByText('Back to Search').closest('a');
      expect(backLink).toHaveAttribute('href', '/search');
    });

    it('handles docAddress parameter correctly', async () => {
      const mockFile = createMockFile();
      vi.mocked(apiClient.getFileByDocAddress).mockResolvedValue(mockFile);
      
      renderFileDetailPage(['/files/doc/test-doc-address']);

      await waitFor(() => {
        expect(apiClient.getFileByDocAddress).toHaveBeenCalledWith('test-doc-address');
      });

      await waitFor(() => {
        expect(screen.getByText('example.js')).toBeInTheDocument();
      });
    });
  });

  describe('File Size and Path Handling', () => {
    it('formats file sizes correctly for different scales', async () => {
      const testCases = [
        { size: 512, expected: '512.0 B' },
        { size: 1536, expected: '1.5 KB' },
        { size: 2097152, expected: '2.0 MB' },
        { size: 1073741824, expected: '1.0 GB' },
      ];

      for (const { size, expected } of testCases) {
        const file = createMockFile({ size });
        vi.mocked(apiClient.getFile).mockResolvedValue(file);
        
        const { unmount } = renderFileDetailPage();

        await waitFor(() => {
          expect(screen.getByText(expected)).toBeInTheDocument();
        });

        unmount();
        vi.clearAllMocks();
      }
    });

    it('handles complex file paths correctly', async () => {
      const complexFile = createMockFile({
        path: 'src/very/deep/nested/folder/structure/ComplexComponent.tsx',
        name: 'ComplexComponent.tsx',
      });

      vi.mocked(apiClient.getFile).mockResolvedValue(complexFile);
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('ComplexComponent.tsx')).toBeInTheDocument();
      });

      expect(screen.getByText('src/very/deep/nested/folder/structure')).toBeInTheDocument();
    });

    it('handles files with special characters in paths', async () => {
      const specialFile = createMockFile({
        path: 'src/special-chars/file with spaces & symbols!.js',
        name: 'file with spaces & symbols!.js',
      });

      vi.mocked(apiClient.getFile).mockResolvedValue(specialFile);
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('file with spaces & symbols!.js')).toBeInTheDocument();
      });

      expect(screen.getByText('src/special-chars')).toBeInTheDocument();
    });
  });

  describe('UI State Integration', () => {
    it('maintains UI state correctly across interactions', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.getFile).mockResolvedValue(createMockFile());
      
      renderFileDetailPage();

      await waitFor(() => {
        expect(screen.getByText('example.js')).toBeInTheDocument();
      });

      // Initial state
      const syntaxHighlighter = screen.getByTestId('syntax-highlighter');
      expect(syntaxHighlighter).toHaveAttribute('data-style', 'oneLight');
      expect(syntaxHighlighter).toHaveAttribute('data-line-numbers', 'true');
      expect(syntaxHighlighter).toHaveAttribute('data-wrap-lines', 'false');

      // Toggle theme, then line numbers, then wrap lines
      const themeButton = screen.getByTestId('moon-icon').parentElement!;
      await user.click(themeButton);

      const lineNumbersButton = screen.getByText('Line Numbers');
      await user.click(lineNumbersButton);

      const wrapLinesButton = screen.getByText('Wrap Lines');
      await user.click(wrapLinesButton);

      // Verify all states are maintained
      await waitFor(() => {
        expect(syntaxHighlighter).toHaveAttribute('data-style', 'oneDark');
        expect(syntaxHighlighter).toHaveAttribute('data-line-numbers', 'false');
        expect(syntaxHighlighter).toHaveAttribute('data-wrap-lines', 'true');
      });

      // Verify theme icon changed
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    });
  });
});