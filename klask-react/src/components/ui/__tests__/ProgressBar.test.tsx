import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/utils';
import { ProgressBar, CrawlProgressBar } from '../ProgressBar';

describe('ProgressBar Component', () => {
  it('should render with default props', () => {
    render(<ProgressBar progress={50} />);

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(<ProgressBar progress={75} label="Download Progress" />);

    expect(screen.getByText('Download Progress')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should hide label when showLabel is false', () => {
    render(<ProgressBar progress={25} showLabel={false} />);

    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
  });

  it('should clamp progress values below 0', () => {
    render(<ProgressBar progress={-10} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
    
    const progressElement = document.querySelector('[style*="width: 0%"]');
    expect(progressElement).toBeInTheDocument();
  });

  it('should clamp progress values above 100', () => {
    render(<ProgressBar progress={150} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    
    const progressElement = document.querySelector('[style*="width: 100%"]');
    expect(progressElement).toBeInTheDocument();
  });

  it('should apply correct size classes', () => {
    const { rerender } = render(<ProgressBar progress={50} size="sm" />);
    
    let progressContainer = document.querySelector('.h-2');
    expect(progressContainer).toBeInTheDocument();

    rerender(<ProgressBar progress={50} size="md" />);
    progressContainer = document.querySelector('.h-3');
    expect(progressContainer).toBeInTheDocument();

    rerender(<ProgressBar progress={50} size="lg" />);
    progressContainer = document.querySelector('.h-4');
    expect(progressContainer).toBeInTheDocument();
  });

  it('should apply correct variant classes', () => {
    const { rerender } = render(<ProgressBar progress={50} variant="default" />);
    
    let progressBar = document.querySelector('.bg-blue-500');
    expect(progressBar).toBeInTheDocument();

    rerender(<ProgressBar progress={50} variant="success" />);
    progressBar = document.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();

    rerender(<ProgressBar progress={50} variant="warning" />);
    progressBar = document.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();

    rerender(<ProgressBar progress={50} variant="error" />);
    progressBar = document.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<ProgressBar progress={50} className="custom-class" />);
    
    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('should handle decimal progress values', () => {
    render(<ProgressBar progress={33.33} />);

    expect(screen.getByText('33%')).toBeInTheDocument();
    
    const progressElement = document.querySelector('[style*="width: 33.33%"]');
    expect(progressElement).toBeInTheDocument();
  });
});

describe('CrawlProgressBar Component', () => {
  const defaultProps = {
    repositoryName: 'Test Repository',
    status: 'processing',
    progress: 50,
    filesProcessed: 100,
    filesTotal: 200,
    filesIndexed: 80,
  };

  it('should render with default props', () => {
    render(<CrawlProgressBar {...defaultProps} />);

    expect(screen.getByText('Test Repository')).toBeInTheDocument();
    expect(screen.getByText('Processing files...')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('100 / 200 files')).toBeInTheDocument();
    expect(screen.getByText('Files processed: 100')).toBeInTheDocument();
    expect(screen.getByText('Files indexed: 80')).toBeInTheDocument();
  });

  it('should display cancelled status correctly', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="cancelled"
        progress={100}
      />
    );

    expect(screen.getByText('Crawl cancelled')).toBeInTheDocument();
    
    // Should use warning variant (yellow) for cancelled
    const progressBar = document.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display completed status correctly', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="completed"
        progress={100}
      />
    );

    expect(screen.getByText('Crawl completed')).toBeInTheDocument();
    
    // Should use success variant (green) for completed
    const progressBar = document.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display failed status correctly', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="failed"
        progress={25}
      />
    );

    expect(screen.getByText('Crawl failed')).toBeInTheDocument();
    
    // Should use error variant (red) for failed
    const progressBar = document.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display starting status correctly', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="starting"
        progress={0}
      />
    );

    expect(screen.getByText('Starting crawl...')).toBeInTheDocument();
    
    // Should use default variant (blue) for starting
    const progressBar = document.querySelector('.bg-blue-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display cloning status correctly', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="cloning"
        progress={10}
      />
    );

    expect(screen.getByText('Cloning repository...')).toBeInTheDocument();
  });

  it('should display indexing status correctly', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="indexing"
        progress={90}
      />
    );

    expect(screen.getByText('Indexing content...')).toBeInTheDocument();
  });

  it('should handle unknown status', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="unknown_status"
        progress={50}
      />
    );

    expect(screen.getByText('unknown_status')).toBeInTheDocument();
    
    // Should use default variant for unknown status
    const progressBar = document.querySelector('.bg-blue-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should handle case-insensitive status', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="CANCELLED"
        progress={100}
      />
    );

    expect(screen.getByText('Crawl cancelled')).toBeInTheDocument();
    
    // Should still apply warning variant for uppercase CANCELLED
    const progressBar = document.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render without filesTotal', () => {
    const propsWithoutTotal = {
      ...defaultProps,
      filesTotal: undefined,
    };

    render(<CrawlProgressBar {...propsWithoutTotal} />);

    expect(screen.getByText('Test Repository')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    
    // Should not display files count or processed/indexed stats
    expect(screen.queryByText('/ files')).not.toBeInTheDocument();
    expect(screen.queryByText('Files processed:')).not.toBeInTheDocument();
  });

  it('should display current file when provided', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        currentFile="src/components/App.tsx"
      />
    );

    expect(screen.getByText('Current file:')).toBeInTheDocument();
    expect(screen.getByText('src/components/App.tsx')).toBeInTheDocument();
  });

  it('should not display current file section when not provided', () => {
    render(<CrawlProgressBar {...defaultProps} />);

    expect(screen.queryByText('Current file:')).not.toBeInTheDocument();
  });

  it('should truncate long file paths', () => {
    const longFilePath = 'src/very/deep/nested/directory/structure/with/a/very/long/file/name.tsx';
    
    render(
      <CrawlProgressBar
        {...defaultProps}
        currentFile={longFilePath}
      />
    );

    const fileElement = screen.getByText(longFilePath);
    const fileContainer = fileElement.closest('.truncate');
    
    expect(fileContainer).toBeInTheDocument();
    expect(fileContainer).toHaveAttribute('title', longFilePath);
  });

  it('should apply custom className', () => {
    render(<CrawlProgressBar {...defaultProps} className="custom-crawl-class" />);
    
    const container = document.querySelector('.custom-crawl-class');
    expect(container).toBeInTheDocument();
  });

  it('should round progress percentage', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        progress={33.7}
      />
    );

    expect(screen.getByText('34%')).toBeInTheDocument();
  });

  it('should handle zero progress', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        progress={0}
        filesProcessed={0}
        filesIndexed={0}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0 / 200 files')).toBeInTheDocument();
    expect(screen.getByText('Files processed: 0')).toBeInTheDocument();
    expect(screen.getByText('Files indexed: 0')).toBeInTheDocument();
  });

  it('should handle maximum progress', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        progress={100}
        filesProcessed={200}
        filesTotal={200}
        filesIndexed={200}
        status="completed"
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('200 / 200 files')).toBeInTheDocument();
    expect(screen.getByText('Files processed: 200')).toBeInTheDocument();
    expect(screen.getByText('Files indexed: 200')).toBeInTheDocument();
  });

  it('should handle cancelled status with partial progress', () => {
    render(
      <CrawlProgressBar
        {...defaultProps}
        status="cancelled"
        progress={45}
        filesProcessed={90}
        filesTotal={200}
        filesIndexed={75}
      />
    );

    expect(screen.getByText('Crawl cancelled')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('90 / 200 files')).toBeInTheDocument();
    expect(screen.getByText('Files processed: 90')).toBeInTheDocument();
    expect(screen.getByText('Files indexed: 75')).toBeInTheDocument();
    
    // Should show warning variant for cancelled
    const progressBar = document.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display different status messages for all stages', () => {
    const statuses = [
      { status: 'starting', expected: 'Starting crawl...' },
      { status: 'cloning', expected: 'Cloning repository...' },
      { status: 'processing', expected: 'Processing files...' },
      { status: 'indexing', expected: 'Indexing content...' },
      { status: 'completed', expected: 'Crawl completed' },
      { status: 'failed', expected: 'Crawl failed' },
      { status: 'cancelled', expected: 'Crawl cancelled' },
    ];

    statuses.forEach(({ status, expected }) => {
      const { unmount } = render(
        <CrawlProgressBar
          {...defaultProps}
          status={status}
        />
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('should apply correct variant for each status', () => {
    const statusVariants = [
      { status: 'completed', expectedClass: 'bg-green-500' },
      { status: 'failed', expectedClass: 'bg-red-500' },
      { status: 'cancelled', expectedClass: 'bg-yellow-500' },
      { status: 'processing', expectedClass: 'bg-blue-500' },
      { status: 'starting', expectedClass: 'bg-blue-500' },
      { status: 'cloning', expectedClass: 'bg-blue-500' },
      { status: 'indexing', expectedClass: 'bg-blue-500' },
    ];

    statusVariants.forEach(({ status, expectedClass }) => {
      const { unmount } = render(
        <CrawlProgressBar
          {...defaultProps}
          status={status}
        />
      );

      const progressBar = document.querySelector(`.${expectedClass}`);
      expect(progressBar).toBeInTheDocument();
      unmount();
    });
  });
});