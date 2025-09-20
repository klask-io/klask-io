import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import userEvent from '@testing-library/user-event';
import { RepositoryCard } from '../RepositoryCard';
import type { Repository, CrawlProgressInfo } from '../../../types';
import { useActiveProgress, useStopCrawl } from '../../../hooks/useRepositories';
import { isRepositoryCrawling, getRepositoryProgressFromActive } from '../../../hooks/useProgress';

// Mock the hooks
vi.mock('../../../hooks/useRepositories', () => ({
  useActiveProgress: vi.fn(),
  useStopCrawl: vi.fn(),
}));

vi.mock('../../../hooks/useProgress', () => ({
  isRepositoryCrawling: vi.fn(),
  getRepositoryProgressFromActive: vi.fn(),
}));

const mockUseActiveProgress = useActiveProgress as any;
const mockUseStopCrawl = useStopCrawl as any;
const mockIsRepositoryCrawling = isRepositoryCrawling as any;
const mockGetRepositoryProgressFromActive = getRepositoryProgressFromActive as any;

describe('RepositoryCard Stop Crawl Functionality', () => {
  const mockStopCrawl = {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  };

  const mockRepository: Repository = {
    id: 'repo-123',
    name: 'Test Repository',
    url: 'https://github.com/test/repo.git',
    repositoryType: 'Git',
    branch: 'main',
    enabled: true,
    accessToken: null,
    gitlabNamespace: null,
    isGroup: false,
    lastCrawled: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockActiveProgress: CrawlProgressInfo[] = [
    {
      repository_id: 'repo-123',
      repository_name: 'Test Repository',
      status: 'processing',
      progress_percentage: 50,
      files_processed: 100,
      files_total: 200,
      files_indexed: 80,
      current_file: 'src/main.ts',
      error_message: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    },
  ];

  const defaultProps = {
    repository: mockRepository,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCrawl: vi.fn(),
    onStopCrawl: vi.fn(),
    onToggleEnabled: vi.fn(),
    activeProgress: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveProgress.mockReturnValue({ data: [] });
    mockUseStopCrawl.mockReturnValue(mockStopCrawl);
    mockIsRepositoryCrawling.mockReturnValue(false);
    mockGetRepositoryProgressFromActive.mockReturnValue(null);
  });

  it('should not show stop button when repository is not crawling', () => {
    render(<RepositoryCard {...defaultProps} />);

    // Stop button should not be visible
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    // Should show crawl button instead
    expect(screen.getByRole('button', { name: /crawl/i })).toBeInTheDocument();
  });

  it('should show stop button when repository is crawling', () => {
    // Mock repository as currently crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Stop button should be visible
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    // Should not show crawl button
    expect(screen.queryByRole('button', { name: /crawl/i })).not.toBeInTheDocument();
  });

  it('should show confirmation dialog when stop button is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Click stop button
    const stopButton = screen.getByRole('button', { name: /stop/i });
    await user.click(stopButton);

    // Confirmation dialog should appear
    expect(screen.getByRole('dialog', { name: /stop crawl/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop crawl/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should cancel confirmation dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Click stop button
    const stopButton = screen.getByRole('button', { name: /stop/i });
    await user.click(stopButton);

    // Click cancel in confirmation dialog
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByText(/stop crawl/i)).not.toBeInTheDocument();
    expect(mockStopCrawl.mutateAsync).not.toHaveBeenCalled();
  });

  it('should call stop crawl mutation when confirmed', async () => {
    const user = userEvent.setup();
    mockStopCrawl.mutateAsync.mockResolvedValue('Crawl stopped');
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Click stop and confirm
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /stop crawl/i });
    await user.click(confirmButton);

    // Mutation should be called
    expect(mockStopCrawl.mutateAsync).toHaveBeenCalledWith('repo-123');
    
    await waitFor(() => {
      expect(screen.queryByText(/stop crawl/i)).not.toBeInTheDocument();
    });
  });

  it('should call onStopCrawl callback when stop succeeds', async () => {
    const user = userEvent.setup();
    const onStopCrawl = vi.fn();
    mockStopCrawl.mutateAsync.mockResolvedValue('Crawl stopped');
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} onStopCrawl={onStopCrawl} />);

    // Stop crawl process
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /stop crawl/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(onStopCrawl).toHaveBeenCalledWith(mockRepository);
    });
  });

  it('should handle stop crawl mutation error', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = new Error('Failed to stop crawl');
    mockStopCrawl.mutateAsync.mockRejectedValue(mockError);
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Try to stop crawl
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /stop crawl/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to stop crawl:', mockError);
    });

    consoleErrorSpy.mockRestore();
  });

  it('should show loading state while stop mutation is pending', async () => {
    const user = userEvent.setup();
    const pendingStopCrawl = {
      ...mockStopCrawl,
      isPending: true,
      mutateAsync: vi.fn(() => new Promise(() => {})), // Never resolves
    };
    mockUseStopCrawl.mockReturnValue(pendingStopCrawl);
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Should show stopping state in button
    const stoppingButton = screen.getByRole('button', { name: /stopping/i });
    expect(stoppingButton).toBeInTheDocument();
    
    // Button should be disabled when pending
    expect(stoppingButton.closest('button')).toBeDisabled();
  });

  it('should work without onStopCrawl callback', async () => {
    const user = userEvent.setup();
    mockStopCrawl.mutateAsync.mockResolvedValue('Crawl stopped');
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    // Render without onStopCrawl prop
    const { onStopCrawl, ...propsWithoutCallback } = defaultProps;
    render(<RepositoryCard {...propsWithoutCallback} />);

    // Should still work without callback
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /stop crawl/i });
    await user.click(confirmButton);

    expect(mockStopCrawl.mutateAsync).toHaveBeenCalledWith('repo-123');
  });

  it('should show stop button with correct icon', () => {
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Should show stop button with stop icon
    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton).toBeInTheDocument();
    
    // Check if stop icon is present (StopCircleIcon)
    const stopIcon = stopButton.closest('button')?.querySelector('svg');
    expect(stopIcon).toBeInTheDocument();
  });

  it('should show confirmation dialog when stop button is clicked directly', async () => {
    const user = userEvent.setup();
    
    // Mock repository as crawling
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Stop button should be visible
    expect(screen.getByText(/stop/i)).toBeInTheDocument();
    
    // Click stop button
    const stopButton = screen.getByRole('button', { name: /stop/i });
    await user.click(stopButton);

    // Confirmation dialog should appear
    expect(screen.getByRole('dialog', { name: /stop crawl/i })).toBeInTheDocument();
  });

  it('should display progress information when crawling', () => {
    // Mock repository as crawling with progress
    mockIsRepositoryCrawling.mockReturnValue(true);
    mockGetRepositoryProgressFromActive.mockReturnValue(mockActiveProgress[0]);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Should show progress information somewhere in the component
    // Note: The exact format might vary depending on ProgressBar component implementation
    const progressElements = screen.getAllByText(/50|100|200/i);
    expect(progressElements.length).toBeGreaterThan(0);
  });

  it('should handle cancelled crawl status correctly', () => {
    const cancelledProgress: CrawlProgressInfo = {
      ...mockActiveProgress[0],
      status: 'cancelled',
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
    };

    // Mock repository as having cancelled progress
    mockIsRepositoryCrawling.mockReturnValue(false); // Cancelled is not crawling
    mockGetRepositoryProgressFromActive.mockReturnValue(cancelledProgress);
    mockUseActiveProgress.mockReturnValue({ data: [cancelledProgress] });

    render(<RepositoryCard {...defaultProps} />);

    // Should not show stop button since crawl is cancelled
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    // Should show crawl button instead
    expect(screen.getByRole('button', { name: /crawl/i })).toBeInTheDocument();
  });
});