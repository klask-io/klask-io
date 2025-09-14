import React from 'react';
import { 
  ChartBarIcon, 
  ServerIcon, 
  UsersIcon, 
  FolderIcon,
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { MetricCard } from '../../components/admin/MetricCard';
import { useAdminDashboard } from '../../hooks/useAdmin';

const AdminDashboard: React.FC = () => {
  const { data: dashboardData, isLoading, error } = useAdminDashboard();

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600">Error loading dashboard: {error instanceof Error ? error.message : String(error)}</p>
        </div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatVersion = (version: string) => version.startsWith('v') ? version : `v${version}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 bg-green-400 rounded-full"></div>
          <span className="text-sm text-gray-500">System Online</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white shadow rounded-lg p-6 animate-pulse">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-gray-200 rounded-md"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* System Overview */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">System Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="System Status"
                value={dashboardData?.system?.database_status || 'Unknown'}
                description={`${formatVersion(dashboardData?.system?.version || '')} • ${dashboardData?.system?.environment || 'Unknown'}`}
                icon={ServerIcon}
                color="green"
              />
              
              <MetricCard
                title="Uptime"
                value={formatUptime(dashboardData?.system?.uptime_seconds || 0)}
                description="System uptime"
                icon={ClockIcon}
                color="blue"
              />
              
              <MetricCard
                title="Total Users"
                value={dashboardData?.users?.total || 0}
                description={`${dashboardData?.users?.active || 0} active, ${dashboardData?.users?.admins || 0} admins`}
                icon={UsersIcon}
                color="purple"
              />
              
              <MetricCard
                title="Repositories"
                value={dashboardData?.repositories?.total_repositories || 0}
                description={`${dashboardData?.repositories?.enabled_repositories || 0} enabled`}
                icon={FolderIcon}
                color="indigo"
              />
            </div>
          </div>

          {/* Content & Search Stats */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Content & Search</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total Files"
                value={dashboardData?.content?.total_files || 0}
                description={formatBytes(dashboardData?.content?.total_size_bytes || 0)}
                icon={DocumentDuplicateIcon}
                color="green"
              />
              
              <MetricCard
                title="Search Index"
                value={dashboardData?.search?.total_documents || 0}
                description={`${dashboardData?.search?.index_size_mb?.toFixed(1) || '0.0'} MB index`}
                icon={MagnifyingGlassIcon}
                color="blue"
              />
              
              <MetricCard
                title="Recent Files"
                value={dashboardData?.content?.recent_additions || 0}
                description="Added in last 24h"
                icon={DocumentDuplicateIcon}
                color="yellow"
                trend={{
                  value: dashboardData?.content?.recent_additions ? Math.round((dashboardData.content.recent_additions / (dashboardData.content.total_files || 1)) * 100) : 0,
                  direction: 'up',
                  label: 'vs total'
                }}
              />
              
              <MetricCard
                title="Crawl Status"
                value={dashboardData?.repositories?.recently_crawled || 0}
                description={`${dashboardData?.repositories?.never_crawled || 0} never crawled`}
                icon={CogIcon}
                color="indigo"
              />
            </div>
          </div>

          {/* Repository Breakdown */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Repository Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="Git Repositories"
                value={dashboardData?.repositories?.git_repositories || 0}
                description="Standard Git repositories"
                color="green"
              />
              
              <MetricCard
                title="GitLab Repositories"
                value={dashboardData?.repositories?.gitlab_repositories || 0}
                description="GitLab hosted repositories"
                color="blue"
              />
              
              <MetricCard
                title="File System"
                value={dashboardData?.repositories?.filesystem_repositories || 0}
                description="Local file system repositories"
                color="yellow"
              />
            </div>
          </div>

          {/* Recent Activity */}
          {dashboardData?.recent_activity && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Users */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Users</h3>
                <div className="space-y-3">
                  {dashboardData.recent_activity.recent_users.length > 0 ? (
                    dashboardData.recent_activity.recent_users.map((user, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.username}</p>
                          <p className="text-xs text-gray-500">{user.role}</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No recent users</p>
                  )}
                </div>
              </div>

              {/* Recent Repositories */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Repositories</h3>
                <div className="space-y-3">
                  {dashboardData.recent_activity.recent_repositories.length > 0 ? (
                    dashboardData.recent_activity.recent_repositories.map((repo, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{repo.name}</p>
                          <p className="text-xs text-gray-500">{repo.repository_type}</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(repo.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No recent repositories</p>
                  )}
                </div>
              </div>

              {/* Recent Crawls */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Crawls</h3>
                <div className="space-y-3">
                  {dashboardData.recent_activity.recent_crawls.length > 0 ? (
                    dashboardData.recent_activity.recent_crawls.map((crawl, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{crawl.repository_name}</p>
                          <p className="text-xs text-gray-500">{crawl.status}</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          {crawl.last_crawled ? new Date(crawl.last_crawled).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No recent crawls</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;