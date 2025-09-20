import { vi } from 'vitest';
import type { CrawlProgressInfo } from '../types';

/**
 * Specialized utilities for testing progress-related functionality
 * Handles timeout issues and polling behavior
 */

// Mock progress data factory
export const createMockProgressInfo = (overrides: Partial<CrawlProgressInfo> = {}): CrawlProgressInfo => ({
  repository_id: 'repo-1',
  repository_name: 'Test Repo',
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
  ...overrides,
});

// Mock API responses for different progress states
export const mockProgressResponses = {
  starting: (repoId: string): CrawlProgressInfo => createMockProgressInfo({
    repository_id: repoId,
    status: 'starting',
    progress_percentage: 0,
    files_processed: 0,
    files_total: null,
    files_indexed: 0,
    current_file: null,
  }),

  processing: (repoId: string, percentage = 50): CrawlProgressInfo => createMockProgressInfo({
    repository_id: repoId,
    status: 'processing',
    progress_percentage: percentage,
    files_processed: Math.floor(percentage),
    files_total: 100,
    files_indexed: Math.floor(percentage * 0.8),
    current_file: `src/file${percentage}.rs`,
  }),

  completed: (repoId: string): CrawlProgressInfo => createMockProgressInfo({
    repository_id: repoId,
    status: 'completed',
    progress_percentage: 100,
    files_processed: 100,
    files_total: 100,
    files_indexed: 100,
    current_file: null,
    completed_at: '2024-01-01T00:05:00Z',
  }),

  failed: (repoId: string, error = 'Crawl failed'): CrawlProgressInfo => createMockProgressInfo({
    repository_id: repoId,
    status: 'failed',
    progress_percentage: 25,
    files_processed: 25,
    files_total: 100,
    files_indexed: 20,
    current_file: null,
    error_message: error,
    completed_at: '2024-01-01T00:03:00Z',
  }),
};

// Timer management for progress polling tests
export class ProgressTestTimer {
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();

  // Mock timer that tracks all created timers
  mockTimers() {
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    const originalClearInterval = global.clearInterval;

    global.setTimeout = vi.fn((callback, ms) => {
      const timer = originalSetTimeout(callback, ms);
      this.timers.add(timer);
      return timer;
    });

    global.setInterval = vi.fn((callback, ms) => {
      const interval = originalSetInterval(callback, ms);
      this.intervals.add(interval);
      return interval;
    });

    global.clearTimeout = vi.fn((timer) => {
      this.timers.delete(timer);
      return originalClearTimeout(timer);
    });

    global.clearInterval = vi.fn((interval) => {
      this.intervals.delete(interval);
      return originalClearInterval(interval);
    });

    return {
      setTimeout: global.setTimeout,
      setInterval: global.setInterval,
      clearTimeout: global.clearTimeout,
      clearInterval: global.clearInterval,
    };
  }

  // Clean up all timers
  cleanup() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.intervals.forEach(interval => clearInterval(interval));
    this.timers.clear();
    this.intervals.clear();
  }

  // Get count of active timers
  getActiveTimerCount() {
    return this.timers.size + this.intervals.size;
  }
}

// Mock progress API with controllable responses
export class MockProgressAPI {
  private progressData: Map<string, CrawlProgressInfo[]> = new Map();
  private callCounts: Map<string, number> = new Map();
  private delays: Map<string, number> = new Map();

  // Set mock data for a repository
  setRepositoryProgress(repoId: string, progressSequence: CrawlProgressInfo[]) {
    this.progressData.set(`repo-${repoId}`, progressSequence);
    this.callCounts.set(`repo-${repoId}`, 0);
  }

  // Set mock data for active progress
  setActiveProgress(progressSequence: CrawlProgressInfo[][]) {
    this.progressData.set('active', progressSequence as any);
    this.callCounts.set('active', 0);
  }

  // Set delay for API responses (simulate slow network)
  setDelay(endpoint: string, ms: number) {
    this.delays.set(endpoint, ms);
  }

  // Mock getRepositoryProgress API
  mockGetRepositoryProgress = vi.fn(async (repoId: string): Promise<CrawlProgressInfo> => {
    const key = `repo-${repoId}`;
    const delay = this.delays.get(key) || 0;
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const progressSequence = this.progressData.get(key) || [];
    const callCount = this.callCounts.get(key) || 0;
    
    this.callCounts.set(key, callCount + 1);
    
    if (progressSequence.length === 0) {
      throw new Error(`No progress data for repository ${repoId}`);
    }

    // Return the appropriate progress based on call count
    const index = Math.min(callCount, progressSequence.length - 1);
    return progressSequence[index];
  });

  // Mock getActiveProgress API
  mockGetActiveProgress = vi.fn(async (): Promise<CrawlProgressInfo[]> => {
    const key = 'active';
    const delay = this.delays.get(key) || 0;
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const progressSequence = this.progressData.get(key) || [];
    const callCount = this.callCounts.get(key) || 0;
    
    this.callCounts.set(key, callCount + 1);
    
    if (progressSequence.length === 0) {
      return [];
    }

    // Return the appropriate progress based on call count
    const index = Math.min(callCount, progressSequence.length - 1);
    return progressSequence[index] as any;
  });

  // Reset all mock data
  reset() {
    this.progressData.clear();
    this.callCounts.clear();
    this.delays.clear();
    this.mockGetRepositoryProgress.mockClear();
    this.mockGetActiveProgress.mockClear();
  }

  // Get call counts for debugging
  getCallCounts() {
    return Object.fromEntries(this.callCounts);
  }
}

// Helper to create a complete progress sequence
export const createProgressSequence = (repoId: string): CrawlProgressInfo[] => [
  mockProgressResponses.starting(repoId),
  mockProgressResponses.processing(repoId, 25),
  mockProgressResponses.processing(repoId, 50),
  mockProgressResponses.processing(repoId, 75),
  mockProgressResponses.completed(repoId),
];

// Helper to create a failed progress sequence
export const createFailedProgressSequence = (repoId: string, error = 'Network error'): CrawlProgressInfo[] => [
  mockProgressResponses.starting(repoId),
  mockProgressResponses.processing(repoId, 25),
  mockProgressResponses.failed(repoId, error),
];

// Test utilities for progress hooks
export const expectProgressToBeLoading = (progressHook: any) => {
  expect(progressHook.isLoading).toBe(true);
  expect(progressHook.error).toBe(null);
  expect(progressHook.progress).toBe(null);
};

export const expectProgressToHaveData = (progressHook: any, expectedData: CrawlProgressInfo) => {
  expect(progressHook.isLoading).toBe(false);
  expect(progressHook.error).toBe(null);
  expect(progressHook.progress).toEqual(expectedData);
};

export const expectProgressToHaveError = (progressHook: any, expectedError: string) => {
  expect(progressHook.isLoading).toBe(false);
  expect(progressHook.error).toBe(expectedError);
  expect(progressHook.progress).toBe(null);
};

export const expectActiveProgressToHaveData = (progressHook: any, expectedData: CrawlProgressInfo[]) => {
  expect(progressHook.isLoading).toBe(false);
  expect(progressHook.error).toBe(null);
  expect(progressHook.activeProgress).toEqual(expectedData);
};