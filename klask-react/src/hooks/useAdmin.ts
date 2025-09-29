import { useQuery } from '@tanstack/react-query';
import { apiClient, getErrorMessage } from '../lib/api';
import type {
  AdminDashboardData,
  SystemStats,
  UserStats,
  RepositoryStats,
  SearchStats,
  RecentActivity
} from '../types';

// Get full admin dashboard data
export const useAdminDashboard = () => {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => apiClient.getAdminDashboard(),
    staleTime: 30000, // 30 seconds - refresh more frequently
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 60000, // Auto-refetch every minute
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};

// Get system stats
export const useSystemStats = () => {
  return useQuery({
    queryKey: ['admin', 'system', 'stats'],
    queryFn: () => apiClient.getSystemStats(),
    staleTime: 30000, // 30 seconds
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};

// Get admin user stats
export const useAdminUserStats = () => {
  return useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => apiClient.getAdminUserStats(),
    staleTime: 60000, // 1 minute
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};

// Get repository stats
export const useRepositoryStats = () => {
  return useQuery({
    queryKey: ['admin', 'repositories', 'stats'],
    queryFn: () => apiClient.getRepositoryStats(),
    staleTime: 60000, // 1 minute
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};


// Get content stats (via search stats)
export const useContentStats = () => {
  return useQuery({
    queryKey: ['admin', 'search', 'stats'], // Use same key as search stats
    queryFn: () => apiClient.getAdminSearchStats(),
    staleTime: 60000, // 1 minute
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};

// Get search stats
export const useAdminSearchStats = () => {
  return useQuery({
    queryKey: ['admin', 'search', 'stats'],
    queryFn: () => apiClient.getAdminSearchStats(),
    staleTime: 60000, // 1 minute
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};

// Get recent activity
export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['admin', 'activity', 'recent'],
    queryFn: () => apiClient.getRecentActivity(),
    staleTime: 30000, // 30 seconds
    retry: false, // Admin endpoints should fail fast for immediate feedback
  });
};

// Combined hook for all admin metrics (alternative to full dashboard)
export const useAdminMetrics = () => {
  const systemStats = useSystemStats();
  const userStats = useAdminUserStats();
  const repositoryStats = useRepositoryStats();
  const searchStats = useAdminSearchStats(); // Renamed for clarity
  const recentActivity = useRecentActivity();

  const isLoading = systemStats.isLoading ||
                   userStats.isLoading ||
                   repositoryStats.isLoading ||
                   searchStats.isLoading ||
                   recentActivity.isLoading;

  const error = systemStats.error ||
               userStats.error ||
               repositoryStats.error ||
               searchStats.error ||
               recentActivity.error;

  const data = {
    system: systemStats.data,
    users: userStats.data,
    repositories: repositoryStats.data,
    content: searchStats.data, // Use search stats data for content
    search: searchStats.data,
    recent_activity: recentActivity.data,
  };

  return {
    data: isLoading ? undefined : data,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch: () => {
      systemStats.refetch();
      userStats.refetch();
      repositoryStats.refetch();
      searchStats.refetch();
      recentActivity.refetch();
    }
  };
};