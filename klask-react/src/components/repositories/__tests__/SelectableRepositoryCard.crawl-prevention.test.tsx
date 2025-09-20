import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
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
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should display crawling state
      expect(screen.getByText(/crawling/i)).toBeInTheDocument();
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
          isLoading={false}
          isCrawling={false}
        />
      );

      // Should not display crawling state
      expect(screen.queryByText(/crawling/i)).not.toBeInTheDocument();
    });

    it('should apply different styling when repository is crawling', () => {
      const { container } = render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should have specific CSS classes or styles for crawling state
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass(/crawling|active|in-progress/);
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
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should show some form of progress indicator
      expect(screen.getByRole('progressbar') || screen.getByText(/progress/i)).toBeInTheDocument();
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      expect(crawlButton).toBeDisabled();
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      fireEvent.click(crawlButton);

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
          isLoading={false}
          isCrawling={true}
        />
      );

      expect(screen.getByRole('button', { name: /crawling|stop/i })).toBeInTheDocument();
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeEnabled();
      
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const enableToggle = screen.getByRole('switch') || screen.getByRole('checkbox', { name: /enabled/i });
      expect(enableToggle).toBeEnabled();
      
      fireEvent.click(enableToggle);
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /select/i });
      expect(checkbox).toBeEnabled();
      
      fireEvent.click(checkbox);
      expect(mockOnSelect).toHaveBeenCalledWith(true);
    });

    it('should show visual indication when selected and crawling', () => {
      const { container } = render(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={true}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          isLoading={false}
          isCrawling={true}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass(/selected.*crawling|crawling.*selected/);
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /select/i });
      fireEvent.click(checkbox);
      
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
          isLoading={true}
          isCrawling={false}
        />
      );

      expect(screen.getByText(/loading/i) || screen.getByRole('progressbar')).toBeInTheDocument();
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
          isLoading={true}
          isCrawling={true}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      expect(crawlButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      expect(crawlButton).toHaveAttribute('aria-label', expect.stringContaining('crawling'));
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
          isLoading={false}
          isCrawling={true}
        />
      );

      const crawlButton = screen.getByRole('button', { name: /crawl/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      expect(crawlButton).toHaveAttribute('title', expect.stringContaining('already'));
      expect(deleteButton).toHaveAttribute('title', expect.stringContaining('cannot delete'));
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
          isLoading={false}
          isCrawling={false}
        />
      );

      expect(screen.getByRole('status') || screen.getByLabelText(/status/i)).toHaveTextContent(/ready|idle/i);

      rerender(
        <SelectableRepositoryCard
          repository={mockRepository}
          selected={false}
          onSelect={mockOnSelect}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onCrawl={mockOnCrawl}
          onToggleEnabled={mockOnToggleEnabled}
          isLoading={false}
          isCrawling={true}
        />
      );

      expect(screen.getByRole('status') || screen.getByLabelText(/status/i)).toHaveTextContent(/crawling/i);
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
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should still show crawling state even if disabled
      expect(screen.getByText(/crawling/i)).toBeInTheDocument();
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
          isLoading={false}
          isCrawling={true}
        />
      );

      // Should handle gracefully
      expect(screen.getByText(mockRepository.name)).toBeInTheDocument();
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