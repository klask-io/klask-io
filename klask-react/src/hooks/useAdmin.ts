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
    retry: 2,
  });
};

// Get system stats
export const useSystemStats = () => {
  return useQuery({
    queryKey: ['admin', 'system', 'stats'],
    queryFn: () => apiClient.getSystemStats(),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};

// Get admin user stats
export const useAdminUserStats = () => {
  return useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => apiClient.getAdminUserStats(),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// Get repository stats
export const useRepositoryStats = () => {
  return useQuery({
    queryKey: ['admin', 'repositories', 'stats'],
    queryFn: () => apiClient.getRepositoryStats(),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};


// Get search stats
export const useAdminSearchStats = () => {
  return useQuery({
    queryKey: ['admin', 'search', 'stats'],
    queryFn: () => apiClient.getAdminSearchStats(),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// Get recent activity
export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['admin', 'activity', 'recent'],
    queryFn: () => apiClient.getRecentActivity(),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};

// Combined hook for all admin metrics (alternative to full dashboard)
export const useAdminMetrics = () => {
  const systemStats = useSystemStats();
  const userStats = useAdminUserStats();
  const repositoryStats = useRepositoryStats();
  const searchStats = useAdminSearchStats();
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