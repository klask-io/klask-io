import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithQueryClient } from '../../test/react-query-test-utils';
import React from 'react';
import {
  useAdminDashboard,
  useSystemStats,
  useAdminUserStats,
  useRepositoryStats,
  useContentStats,
  useAdminSearchStats,
  useRecentActivity,
  useAdminMetrics,
} from '../useAdmin';
import { apiClient } from '../../lib/api';

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    getAdminDashboard: vi.fn(),
    getSystemStats: vi.fn(),
    getAdminUserStats: vi.fn(),
    getRepositoryStats: vi.fn(),
    getContentStats: vi.fn(),
    getAdminSearchStats: vi.fn(),
    getRecentActivity: vi.fn(),
  },
}));

const mockApiClient = apiClient as any;

describe('useAdmin hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAdminDashboard', () => {
    it('should fetch admin dashboard data', async () => {
      const mockDashboard = {
        system: {
          uptime_seconds: 3600,
          version: '1.0.0',
          environment: 'production',
          database_status: 'Connected',
        },
        users: {
          total_users: 100,
          active_users: 85,
          admin_users: 5,
          recent_signups: 10,
        },
        repositories: {
          total_repositories: 50,
          enabled_repositories: 45,
          disabled_repositories: 5,
          git_repositories: 30,
          gitlab_repositories: 15,
          filesystem_repositories: 5,
          recently_crawled: 20,
          never_crawled: 10,
        },
        content: {
          total_files: 10000,
          total_size_bytes: 50000000,
          files_by_extension: [
            { extension: 'rs', count: 5000, total_size: 25000000 },
            { extension: 'js', count: 3000, total_size: 15000000 },
          ],
          files_by_project: [
            { project: 'project-a', file_count: 6000, total_size: 30000000 },
            { project: 'project-b', file_count: 4000, total_size: 20000000 },
          ],
          recent_additions: 500,
        },
        search: {
          total_documents: 10000,
          index_size_mb: 100.5,
          avg_search_time_ms: 25.3,
          popular_queries: [
            { query: 'function', count: 150 },
            { query: 'class', count: 120 },
          ],
        },
        recent_activity: {
          recent_users: [],
          recent_repositories: [],
          recent_crawls: [],
        },
      };

      mockApiClient.getAdminDashboard.mockResolvedValue(mockDashboard);

      const { result } = renderHookWithQueryClient(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockDashboard);
      expect(mockApiClient.getAdminDashboard).toHaveBeenCalledTimes(1);
    });

    it('should handle dashboard fetch errors', async () => {
      const mockError = new Error('Dashboard error');
      mockApiClient.getAdminDashboard.mockRejectedValue(mockError);

      const { result } = renderHookWithQueryClient(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should cache dashboard data for 1 minute', async () => {
      const mockData = { system: {}, users: {}, repositories: {} };
      mockApiClient.getAdminDashboard.mockResolvedValue(mockData);

      const { result, rerender } = renderHookWithQueryClient(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Rerender should use cached data
      rerender();
      expect(mockApiClient.getAdminDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSystemStats', () => {
    it('should fetch system statistics', async () => {
      const mockStats = {
        uptime_seconds: 7200,
        version: '1.0.1',
        environment: 'development',
        database_status: 'Connected',
      };

      mockApiClient.getSystemStats.mockResolvedValue(mockStats);

      const { result } = renderHookWithQueryClient(() => useSystemStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStats);
      expect(mockApiClient.getSystemStats).toHaveBeenCalledTimes(1);
    });

    it('should handle system stats errors', async () => {
      mockApiClient.getSystemStats.mockRejectedValue(new Error('System error'));

      const { result } = renderHookWithQueryClient(() => useSystemStats());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useAdminUserStats', () => {
    it('should fetch user statistics', async () => {
      const mockUserStats = {
        total_users: 150,
        active_users: 120,
        admin_users: 8,
        recent_signups: 15,
      };

      mockApiClient.getAdminUserStats.mockResolvedValue(mockUserStats);

      const { result } = renderHookWithQueryClient(() => useAdminUserStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUserStats);
    });
  });

  describe('useRepositoryStats', () => {
    it('should fetch repository statistics', async () => {
      const mockRepoStats = {
        total_repositories: 75,
        enabled_repositories: 70,
        disabled_repositories: 5,
        git_repositories: 45,
        gitlab_repositories: 25,
        filesystem_repositories: 5,
        recently_crawled: 35,
        never_crawled: 15,
      };

      mockApiClient.getRepositoryStats.mockResolvedValue(mockRepoStats);

      const { result } = renderHookWithQueryClient(() => useRepositoryStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRepoStats);
      expect(result.current.data.total_repositories).toBe(
        result.current.data.enabled_repositories + result.current.data.disabled_repositories
      );
    });
  });

  describe('useContentStats', () => {
    it('should fetch content statistics', async () => {
      const mockContentStats = {
        total_files: 25000,
        total_size_bytes: 125000000,
        files_by_extension: [
          { extension: 'ts', count: 12000, total_size: 60000000 },
          { extension: 'js', count: 8000, total_size: 40000000 },
          { extension: 'py', count: 5000, total_size: 25000000 },
        ],
        files_by_project: [
          { project: 'frontend', file_count: 15000, total_size: 75000000 },
          { project: 'backend', file_count: 10000, total_size: 50000000 },
        ],
        recent_additions: 1200,
      };

      mockApiClient.getContentStats.mockResolvedValue(mockContentStats);

      const { result } = renderHookWithQueryClient(() => useContentStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockContentStats);
      
      // Validate data consistency
      const totalFromExtensions = result.current.data.files_by_extension
        .reduce((sum, ext) => sum + ext.count, 0);
      expect(totalFromExtensions).toBe(result.current.data.total_files);
    });
  });

  describe('useAdminSearchStats', () => {
    it('should fetch search statistics', async () => {
      const mockSearchStats = {
        total_documents: 25000,
        index_size_mb: 150.75,
        avg_search_time_ms: 18.5,
        popular_queries: [
          { query: 'async', count: 200 },
          { query: 'await', count: 180 },
          { query: 'function', count: 160 },
        ],
      };

      mockApiClient.getAdminSearchStats.mockResolvedValue(mockSearchStats);

      const { result } = renderHookWithQueryClient(() => useAdminSearchStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSearchStats);
      expect(result.current.data.popular_queries).toHaveLength(3);
    });
  });

  describe('useRecentActivity', () => {
    it('should fetch recent activity data', async () => {
      const mockActivity = {
        recent_users: [
          {
            username: 'newuser1',
            email: 'newuser1@example.com',
            created_at: '2024-01-01T12:00:00Z',
            role: 'User',
          },
          {
            username: 'admin2',
            email: 'admin2@example.com',
            created_at: '2024-01-01T11:00:00Z',
            role: 'Admin',
          },
        ],
        recent_repositories: [
          {
            name: 'new-project',
            url: 'https://github.com/example/new-project.git',
            repository_type: 'Git',
            created_at: '2024-01-01T10:00:00Z',
          },
        ],
        recent_crawls: [
          {
            repository_name: 'active-project',
            last_crawled: '2024-01-01T09:00:00Z',
            status: 'Completed',
          },
          {
            repository_name: 'test-project',
            last_crawled: '2024-01-01T08:30:00Z',
            status: 'Failed',
          },
        ],
      };

      mockApiClient.getRecentActivity.mockResolvedValue(mockActivity);

      const { result } = renderHookWithQueryClient(() => useRecentActivity());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockActivity);
      expect(result.current.data.recent_users).toHaveLength(2);
      expect(result.current.data.recent_repositories).toHaveLength(1);
      expect(result.current.data.recent_crawls).toHaveLength(2);
    });

    it('should handle empty activity data', async () => {
      const emptyActivity = {
        recent_users: [],
        recent_repositories: [],
        recent_crawls: [],
      };

      mockApiClient.getRecentActivity.mockResolvedValue(emptyActivity);

      const { result } = renderHookWithQueryClient(() => useRecentActivity());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(emptyActivity);
      expect(result.current.data.recent_users).toHaveLength(0);
    });
  });

  describe('useAdminMetrics', () => {
    it('should combine all admin metrics', async () => {
      const mockSystemStats = {
        uptime_seconds: 3600,
        version: '1.0.0',
        environment: 'test',
        database_status: 'Connected',
      };

      const mockUserStats = {
        total_users: 50,
        active_users: 40,
        admin_users: 3,
        recent_signups: 5,
      };

      const mockRepoStats = {
        total_repositories: 25,
        enabled_repositories: 23,
        disabled_repositories: 2,
        git_repositories: 20,
        gitlab_repositories: 5,
        filesystem_repositories: 0,
        recently_crawled: 10,
        never_crawled: 5,
      };

      const mockContentStats = {
        total_files: 5000,
        total_size_bytes: 25000000,
        files_by_extension: [],
        files_by_project: [],
        recent_additions: 100,
      };

      const mockSearchStats = {
        total_documents: 5000,
        index_size_mb: 50.25,
        avg_search_time_ms: 20.1,
        popular_queries: [],
      };

      const mockActivity = {
        recent_users: [],
        recent_repositories: [],
        recent_crawls: [],
      };

      mockApiClient.getSystemStats.mockResolvedValue(mockSystemStats);
      mockApiClient.getAdminUserStats.mockResolvedValue(mockUserStats);
      mockApiClient.getRepositoryStats.mockResolvedValue(mockRepoStats);
      mockApiClient.getContentStats.mockResolvedValue(mockContentStats);
      mockApiClient.getAdminSearchStats.mockResolvedValue(mockSearchStats);
      mockApiClient.getRecentActivity.mockResolvedValue(mockActivity);

      const { result } = renderHookWithQueryClient(() => useAdminMetrics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
      });

      expect(result.current.data).toEqual({
        system: mockSystemStats,
        users: mockUserStats,
        repositories: mockRepoStats,
        content: mockContentStats,
        search: mockSearchStats,
        recent_activity: mockActivity,
      });

      // Verify all API endpoints were called
      expect(mockApiClient.getSystemStats).toHaveBeenCalled();
      expect(mockApiClient.getAdminUserStats).toHaveBeenCalled();
      expect(mockApiClient.getRepositoryStats).toHaveBeenCalled();
      expect(mockApiClient.getContentStats).toHaveBeenCalled();
      expect(mockApiClient.getAdminSearchStats).toHaveBeenCalled();
      expect(mockApiClient.getRecentActivity).toHaveBeenCalled();
    });

    it('should handle partial errors in metrics', async () => {
      mockApiClient.getSystemStats.mockResolvedValue({
        uptime_seconds: 3600,
        version: '1.0.0',
        environment: 'test',
        database_status: 'Connected',
      });

      mockApiClient.getAdminUserStats.mockRejectedValue(new Error('User stats error'));
      mockApiClient.getRepositoryStats.mockResolvedValue({
        total_repositories: 10,
        enabled_repositories: 8,
        disabled_repositories: 2,
        git_repositories: 8,
        gitlab_repositories: 2,
        filesystem_repositories: 0,
        recently_crawled: 5,
        never_crawled: 2,
      });

      mockApiClient.getContentStats.mockRejectedValue(new Error('Content stats error'));
      mockApiClient.getAdminSearchStats.mockResolvedValue({
        total_documents: 1000,
        index_size_mb: 10.5,
        avg_search_time_ms: 15.0,
        popular_queries: [],
      });

      mockApiClient.getRecentActivity.mockResolvedValue({
        recent_users: [],
        recent_repositories: [],
        recent_crawls: [],
      });

      const { result } = renderHookWithQueryClient(() => useAdminMetrics());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Should return error from first failed query
      expect(result.current.error).toContain('User stats error');
    });

    it('should provide refetch functionality', async () => {
      const mockStats = {
        uptime_seconds: 3600,
        version: '1.0.0',
        environment: 'test',
        database_status: 'Connected',
      };

      mockApiClient.getSystemStats.mockResolvedValue(mockStats);
      mockApiClient.getAdminUserStats.mockResolvedValue({
        total_users: 1,
        active_users: 1,
        admin_users: 1,
        recent_signups: 0,
      });
      mockApiClient.getRepositoryStats.mockResolvedValue({
        total_repositories: 1,
        enabled_repositories: 1,
        disabled_repositories: 0,
        git_repositories: 1,
        gitlab_repositories: 0,
        filesystem_repositories: 0,
        recently_crawled: 0,
        never_crawled: 1,
      });
      mockApiClient.getContentStats.mockResolvedValue({
        total_files: 1,
        total_size_bytes: 1000,
        files_by_extension: [],
        files_by_project: [],
        recent_additions: 1,
      });
      mockApiClient.getAdminSearchStats.mockResolvedValue({
        total_documents: 1,
        index_size_mb: 0.1,
        avg_search_time_ms: 1.0,
        popular_queries: [],
      });
      mockApiClient.getRecentActivity.mockResolvedValue({
        recent_users: [],
        recent_repositories: [],
        recent_crawls: [],
      });

      const { result } = renderHookWithQueryClient(() => useAdminMetrics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test refetch functionality
      expect(typeof result.current.refetch).toBe('function');

      // Clear mock call history
      vi.clearAllMocks();

      // Call refetch
      result.current.refetch();

      // Verify all endpoints are called again
      expect(mockApiClient.getSystemStats).toHaveBeenCalled();
      expect(mockApiClient.getAdminUserStats).toHaveBeenCalled();
      expect(mockApiClient.getRepositoryStats).toHaveBeenCalled();
      expect(mockApiClient.getContentStats).toHaveBeenCalled();
      expect(mockApiClient.getAdminSearchStats).toHaveBeenCalled();
      expect(mockApiClient.getRecentActivity).toHaveBeenCalled();
    });

    it('should show loading state correctly', async () => {
      // Mock slow responses
      mockApiClient.getSystemStats.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          uptime_seconds: 3600,
          version: '1.0.0',
          environment: 'test',
          database_status: 'Connected',
        }), 100))
      );

      mockApiClient.getAdminUserStats.mockResolvedValue({
        total_users: 1, active_users: 1, admin_users: 1, recent_signups: 0,
      });
      mockApiClient.getRepositoryStats.mockResolvedValue({
        total_repositories: 1, enabled_repositories: 1, disabled_repositories: 0,
        git_repositories: 1, gitlab_repositories: 0, filesystem_repositories: 0,
        recently_crawled: 0, never_crawled: 1,
      });
      mockApiClient.getContentStats.mockResolvedValue({
        total_files: 1, total_size_bytes: 1000, files_by_extension: [],
        files_by_project: [], recent_additions: 1,
      });
      mockApiClient.getAdminSearchStats.mockResolvedValue({
        total_documents: 1, index_size_mb: 0.1, avg_search_time_ms: 1.0, popular_queries: [],
      });
      mockApiClient.getRecentActivity.mockResolvedValue({
        recent_users: [], recent_repositories: [], recent_crawls: [],
      });

      const { result } = renderHookWithQueryClient(() => useAdminMetrics());

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
    });
  });
});