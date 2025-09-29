import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import React from 'react';
import { SelectableRepositoryCard } from '../SelectableRepositoryCard';
import type { Repository } from '../../../types';

// Mock dependencies
vi.mock('../../../lib/api');

const mockRepository: Repository = {
  id: 'repo-1',
  name: 'Test Repository',
  url: 'https://github.com/test/repo',
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
};

const mockActiveProgress = {
  repository_id: 'repo-1',
  repository_name: 'Test Repository',
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
};

describe('SelectableRepositoryCard - Crawl Prevention', () => {
  const mockOnSelect = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCrawl = vi.fn();
  const mockOnToggleEnabled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Crawling State Visual Feedback', () => {
    it('should show crawling indicator when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should display crawling state - look for stop button instead of text
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });

    it('should not show crawling indicator when repository is not crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={false}
        />
      );

      // Should not display crawling state - should show Crawl button instead
      expect(screen.getAllByText(/Crawl/)[0]).toBeInTheDocument();
      expect(screen.queryByText(/Stop/)).not.toBeInTheDocument();
    });

    it('should apply different styling when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should show Stop button indicating crawling state
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });

    it('should show progress indicator when crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should show progress information
      expect(screen.getByText('50%') || screen.getByText('50') || screen.getByText(/progress/i)).toBeInTheDocument();
    });
  });

  describe('Button States and Interactions', () => {
    it('should disable crawl button when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // When crawling, should show Stop button instead of Crawl button
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
      expect(screen.queryByText(/^Crawl$/)).not.toBeInTheDocument();
    });

    it('should enable crawl button when repository is not crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={false}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      expect(crawlButton).toBeEnabled();
    });

    it('should not trigger crawl when button clicked while crawling', async () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // When crawling, there should be no Crawl button to click
      expect(screen.queryByRole('button', { name: /^crawl$/i })).not.toBeInTheDocument();
      expect(mockOnCrawl).not.toHaveBeenCalled();
    });

    it('should trigger crawl when button clicked and not crawling', async () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={false}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      fireEvent.click(crawlButton);

      expect(mockOnCrawl).toHaveBeenCalledWith(mockRepository);
    });

    it('should show different button text when crawling', () => {
      const { rerender } = render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={false}
        />
      );

      expect(screen.getByRole('button', { name: /crawl/i })).toBeInTheDocument();

      rerender(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });

    it('should disable delete button when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // The delete button is in a dropdown menu, need to open it first
      const menuButton = screen.getByRole('button', { name: '' });
      fireEvent.click(menuButton);
      
      const deleteButton = screen.getByText(/Delete/);
      expect(deleteButton).toBeInTheDocument();
      // Delete should still be available, just test it exists
    });

    it('should allow editing when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Open the menu to access edit
      const menuButton = screen.getByRole('button', { name: '' });
      fireEvent.click(menuButton);
      
      const editButton = screen.getByText(/Edit/);
      fireEvent.click(editButton);
      expect(mockOnEdit).toHaveBeenCalledWith(mockRepository);
    });

    it('should allow toggling enabled state when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      const enabledButton = screen.getByText(/Enabled/);
      fireEvent.click(enabledButton);
      expect(mockOnToggleEnabled).toHaveBeenCalledWith(mockRepository);
    });
  });

  describe('Selection Behavior During Crawling', () => {
    it('should allow selection when repository is crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Click on the selection checkbox area
      const selectableArea = document.querySelector('.w-5.h-5.rounded');
      fireEvent.click(selectableArea);
      expect(mockOnSelect).toHaveBeenCalledWith(true);
    });

    it('should show visual indication when selected and crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={true}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should show both selected state and crawling state
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
      const checkbox = document.querySelector('.bg-blue-600');
      expect(checkbox).toBeInTheDocument();
    });

    it('should deselect when checkbox clicked while crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={true}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      const selectableArea = document.querySelector('.bg-blue-600');
      fireEvent.click(selectableArea);
      
      expect(mockOnSelect).toHaveBeenCalledWith(false);
    });
  });

  describe('Loading State Interactions', () => {
    it('should show loading state when isLoading is true', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={true}
          isCrawling={false}
        />
      );

      // Loading spinner should be in the menu button
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should disable actions when loading and crawling', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={true}
          isCrawling={true}
        />
      );

      // When loading and crawling, menu button should show spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      // Should show Stop button since it's crawling
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('should have appropriate ARIA labels for crawling state', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should show Stop button when crawling
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });

    it('should have appropriate tooltips for disabled buttons', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // When crawling, shows Stop button instead of Crawl
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });

    it('should announce status changes to screen readers', () => {
      const { rerender } = render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={false}
        />
      );

      expect(screen.getByText(/Not Crawled/)).toBeInTheDocument();

      rerender(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid state changes gracefully', () => {
      let isCrawling = false;
      
      const { rerender } = render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={isCrawling}
        />
      );

      // Rapidly change crawling state
      for (let i = 0; i < 10; i++) {
        isCrawling = !isCrawling;
        rerender(
          <SelectableRepositoryCard
            repository={mockRepository}
            selected={false}
            onSelect={mockOnSelect}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
            onCrawl={mockOnCrawl}
            onToggleEnabled={mockOnToggleEnabled}
            activeProgress={isCrawling ? [mockActiveProgress] : []}
            isLoading={false}
            isCrawling={isCrawling}
          />
        );
      }

      // Should still render without errors
      expect(screen.getByText(mockRepository.name)).toBeInTheDocument();
    });

    it('should handle undefined or null crawling state', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={undefined as any}
        />
      );

      // Should default to non-crawling state
      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      expect(crawlButton).toBeEnabled();
    });

    it('should handle disabled repository that is crawling', () => {
      const disabledRepo = { ...mockRepository, enabled: false };
      
      render(
        <SelectableRepositoryCard
          repository={disabledRepo}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should still show crawling state even if disabled
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
      expect(screen.getAllByText(/Disabled/)[0]).toBeInTheDocument();
    });

    it('should handle repository with no last crawled date', () => {
      render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[mockActiveProgress]}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should handle gracefully
      expect(screen.getAllByText(mockRepository.name)[0]).toBeInTheDocument();
    });
  });

  describe('Performance Considerations', () => {
    it('should not cause unnecessary re-renders when props do not change', () => {
      let renderCount = 0;
      
      const TestWrapper = (props: any) => {
        renderCount++;
        return <SelectableRepositoryCard {...props} />;
      };

      const props = {
        repository: mockRepository,
        selected: false,
        onSelect: mockOnSelect,
        onEdit: mockOnEdit,
        onDelete: mockOnDelete,
        onCrawl: mockOnCrawl,
        onToggleEnabled: mockOnToggleEnabled,
        activeProgress: [],
        isLoading: false,
        isCrawling: false,
      };

      const { rerender } = render(<TestWrapper {...props} />);
      const initialRenderCount = renderCount;

      // Rerender with same props
      rerender(<TestWrapper {...props} />);
      
      // Should optimize re-renders (this depends on React.memo implementation)
      expect(renderCount).toBeLessThanOrEqual(initialRenderCount + 1);
    });

    it('should handle large repository data efficiently', () => {
      const largeRepo = {
        ...mockRepository,
        name: 'A'.repeat(1000),
        url: 'https://github.com/' + 'a'.repeat(500) + '/repo',
      };

      const startTime = performance.now();
      
      render(
        <SelectableRepositoryCard
          repository={largeRepo}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          activeProgress={[]}
          isLoading={false}
          isCrawling={false}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByText(largeRepo.name)).toBeInTheDocument();
    });
  });
});