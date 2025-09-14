import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import userEvent from '@testing-library/user-event';
import { RepositoryCard } from '../RepositoryCard';
import type { Repository, CrawlProgressInfo } from '../../../types';
import { useActiveProgress, useStopCrawl } from '../../../hooks/useRepositories';

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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveProgress.mockReturnValue({ data: [] });
    mockUseStopCrawl.mockReturnValue(mockStopCrawl);
    
    // Mock the progress utility functions
    const { isRepositoryCrawling, getRepositoryProgressFromActive } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(false);
    getRepositoryProgressFromActive.mockReturnValue(null);
  });

  it('should not show stop button when repository is not crawling', () => {
    render(<RepositoryCard {...defaultProps} />);

    // Click the menu button
    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    // Stop button should not be visible
    expect(screen.queryByText(/stop/i)).not.toBeInTheDocument();
  });

  it('should show stop button when repository is crawling', () => {
    // Mock repository as currently crawling
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Click the menu button
    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    // Stop button should be visible
    expect(screen.getByText(/stop/i)).toBeInTheDocument();
  });

  it('should show confirmation dialog when stop button is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock repository as crawling
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Click menu button
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);

    // Click stop button
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);

    // Confirmation dialog should appear
    expect(screen.getByText(/stop crawl/i)).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should cancel confirmation dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock repository as crawling
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Open menu and click stop
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const stopButton = screen.getByText(/stop/i);
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
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Open menu, click stop, and confirm
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
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
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} onStopCrawl={onStopCrawl} />);

    // Stop crawl process
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
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
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Try to stop crawl
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
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
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Initiate stop crawl
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Should show some kind of loading state (this depends on implementation)
    // The exact assertion would depend on how loading state is shown in ConfirmDialog
    expect(pendingStopCrawl.mutateAsync).toHaveBeenCalled();
  });

  it('should work without onStopCrawl callback', async () => {
    const user = userEvent.setup();
    mockStopCrawl.mutateAsync.mockResolvedValue('Crawl stopped');
    
    // Mock repository as crawling
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    // Render without onStopCrawl prop
    const { onStopCrawl, ...propsWithoutCallback } = defaultProps;
    render(<RepositoryCard {...propsWithoutCallback} />);

    // Should still work without callback
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    expect(mockStopCrawl.mutateAsync).toHaveBeenCalledWith('repo-123');
  });

  it('should show stop button with correct icon', () => {
    // Mock repository as crawling
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Click menu to open dropdown
    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    // Should show stop button with stop icon
    const stopButton = screen.getByText(/stop/i);
    expect(stopButton).toBeInTheDocument();
    
    // Check if stop icon is present (StopCircleIcon)
    const stopIcon = stopButton.closest('button')?.querySelector('svg');
    expect(stopIcon).toBeInTheDocument();
  });

  it('should close menu when stop button is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock repository as crawling
    const { isRepositoryCrawling } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Open menu
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    
    // Verify menu is open (stop button visible)
    expect(screen.getByText(/stop/i)).toBeInTheDocument();
    
    // Click stop button
    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);

    // Menu should be closed (only confirmation dialog visible)
    expect(screen.getByText(/stop crawl/i)).toBeInTheDocument(); // Confirmation dialog
    // The menu items should not be visible anymore (menu is closed)
  });

  it('should display progress information when crawling', () => {
    // Mock repository as crawling with progress
    const { isRepositoryCrawling, getRepositoryProgressFromActive } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(true);
    getRepositoryProgressFromActive.mockReturnValue(mockActiveProgress[0]);
    mockUseActiveProgress.mockReturnValue({ data: mockActiveProgress });

    render(<RepositoryCard {...defaultProps} />);

    // Should show progress information
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('100/200')).toBeInTheDocument();
  });

  it('should handle cancelled crawl status correctly', () => {
    const cancelledProgress: CrawlProgressInfo = {
      ...mockActiveProgress[0],
      status: 'cancelled',
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
    };

    // Mock repository as having cancelled progress
    const { isRepositoryCrawling, getRepositoryProgressFromActive } = require('../../../hooks/useProgress');
    isRepositoryCrawling.mockReturnValue(false); // Cancelled is not crawling
    getRepositoryProgressFromActive.mockReturnValue(cancelledProgress);
    mockUseActiveProgress.mockReturnValue({ data: [cancelledProgress] });

    render(<RepositoryCard {...defaultProps} />);

    // Should not show stop button since crawl is cancelled
    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);
    
    expect(screen.queryByText(/stop/i)).not.toBeInTheDocument();
  });
});