import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '../AdminDashboard';

// Mock the useAdminDashboard hook
vi.mock('../../hooks/useAdmin', () => ({
  useAdminDashboard: vi.fn(),
}));

// Mock MetricCard component
vi.mock('../../components/admin/MetricCard', () => ({
  MetricCard: vi.fn(({ title, value, description, icon: Icon, color, trend }) => (
    <div data-testid="metric-card" data-title={title} data-color={color}>
      <div data-testid="metric-title">{title}</div>
      <div data-testid="metric-value">{value}</div>
      <div data-testid="metric-description">{description}</div>
      {Icon && <div data-testid="metric-icon"><Icon /></div>}
      {trend && (
        <div data-testid="metric-trend" data-direction={trend.direction}>
          {trend.value}% {trend.label}
        </div>
      )}
    </div>
  )),
}));

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChartBarIcon: () => <div data-testid="chart-bar-icon" />,
  ServerIcon: () => <div data-testid="server-icon" />,
  UsersIcon: () => <div data-testid="users-icon" />,
  FolderIcon: () => <div data-testid="folder-icon" />,
  MagnifyingGlassIcon: () => <div data-testid="search-icon" />,
  DocumentDuplicateIcon: () => <div data-testid="document-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  CogIcon: () => <div data-testid="cog-icon" />,
}));

describe('AdminDashboard', () => {
  let queryClient: QueryClient;
  const mockUseAdminDashboard = vi.mocked(require('../../hooks/useAdmin').useAdminDashboard);

  const mockDashboardData = {
    system: {
      uptime_seconds: 3665, // 1 hour, 1 minute, 5 seconds
      version: '1.0.0',
      environment: 'production',
      database_status: 'Connected',
    },
    users: {
      total: 100,
      active: 85,
      admins: 5,
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
      total_size_bytes: 1073741824, // 1GB
      recent_additions: 100,
      files_by_extension: [],
      files_by_project: [],
    },
    search: {
      total_documents: 9500,
      index_size_mb: 125.5,
      avg_search_time_ms: null,
      popular_queries: [],
    },
    recent_activity: {
      recent_users: [
        {
          username: 'john_doe',
          email: 'john@example.com',
          created_at: '2023-12-01T10:00:00Z',
          role: 'User',
        },
        {
          username: 'admin_user',
          email: 'admin@example.com',
          created_at: '2023-12-01T09:00:00Z',
          role: 'Admin',
        },
      ],
      recent_repositories: [
        {
          name: 'test-repo',
          url: 'https://github.com/test/test-repo',
          repository_type: 'Git',
          created_at: '2023-12-01T08:00:00Z',
        },
      ],
      recent_crawls: [
        {
          repository_name: 'test-repo',
          last_crawled: '2023-12-01T12:00:00Z',
          status: 'Completed',
        },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminDashboard />
      </QueryClientProvider>
    );
  };

  it('renders loading state', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderComponent();

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('System Online')).toBeInTheDocument();
    
    // Should show loading skeletons
    const loadingCards = screen.getAllByText((content, element) => {
      return element?.classList.contains('animate-pulse') ?? false;
    });
    expect(loadingCards.length).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: 'Failed to load dashboard data',
    });

    renderComponent();

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Error loading dashboard: Failed to load dashboard data')).toBeInTheDocument();
  });

  it('renders dashboard data correctly', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('System Online')).toBeInTheDocument();

    // Check system overview metrics
    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Connected')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1h 1m')).toBeInTheDocument(); // Formatted uptime
    expect(screen.getByDisplayValue('100')).toBeInTheDocument(); // Total users
    expect(screen.getByDisplayValue('50')).toBeInTheDocument(); // Total repositories
  });

  it('formats bytes correctly', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    // Should format 1GB correctly
    expect(screen.getByDisplayValue('1 GB')).toBeInTheDocument();
  });

  it('formats uptime correctly', () => {
    const testCases = [
      { seconds: 3600, expected: '1h 0m' }, // 1 hour
      { seconds: 90061, expected: '1d 1h' }, // 1 day, 1 hour, 1 minute, 1 second
      { seconds: 300, expected: '5m' }, // 5 minutes
    ];

    testCases.forEach(({ seconds, expected }) => {
      const testData = {
        ...mockDashboardData,
        system: { ...mockDashboardData.system, uptime_seconds: seconds },
      };

      mockUseAdminDashboard.mockReturnValue({
        data: testData,
        isLoading: false,
        error: null,
      });

      const { unmount } = renderComponent();
      expect(screen.getByDisplayValue(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('formats version correctly', () => {
    const testData = {
      ...mockDashboardData,
      system: { ...mockDashboardData.system, version: '1.2.3' },
    };

    mockUseAdminDashboard.mockReturnValue({
      data: testData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByDisplayValue('v1.2.3 • production')).toBeInTheDocument();
  });

  it('renders content and search stats', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByText('Content & Search')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10000')).toBeInTheDocument(); // Total files
    expect(screen.getByDisplayValue('9500')).toBeInTheDocument(); // Search documents
    expect(screen.getByDisplayValue('100')).toBeInTheDocument(); // Recent additions
    expect(screen.getByDisplayValue('20')).toBeInTheDocument(); // Recently crawled
  });

  it('renders repository type breakdown', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByText('Repository Types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Git repositories
    expect(screen.getByDisplayValue('15')).toBeInTheDocument(); // GitLab repositories
    expect(screen.getByDisplayValue('5')).toBeInTheDocument(); // File system repositories
  });

  it('renders recent activity sections', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    // Recent Users
    expect(screen.getByText('Recent Users')).toBeInTheDocument();
    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.getByText('admin_user')).toBeInTheDocument();

    // Recent Repositories
    expect(screen.getByText('Recent Repositories')).toBeInTheDocument();
    expect(screen.getByText('test-repo')).toBeInTheDocument();

    // Recent Crawls
    expect(screen.getByText('Recent Crawls')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('handles empty recent activity', () => {
    const dataWithEmptyActivity = {
      ...mockDashboardData,
      recent_activity: {
        recent_users: [],
        recent_repositories: [],
        recent_crawls: [],
      },
    };

    mockUseAdminDashboard.mockReturnValue({
      data: dataWithEmptyActivity,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByText('No recent users')).toBeInTheDocument();
    expect(screen.getByText('No recent repositories')).toBeInTheDocument();
    expect(screen.getByText('No recent crawls')).toBeInTheDocument();
  });

  it('handles missing recent activity section', () => {
    const dataWithoutActivity = {
      ...mockDashboardData,
      recent_activity: undefined,
    };

    mockUseAdminDashboard.mockReturnValue({
      data: dataWithoutActivity,
      isLoading: false,
      error: null,
    });

    renderComponent();

    // Should not render recent activity sections
    expect(screen.queryByText('Recent Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent Repositories')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent Crawls')).not.toBeInTheDocument();
  });

  it('handles zero values gracefully', () => {
    const zeroData = {
      system: {
        uptime_seconds: 0,
        version: '',
        environment: '',
        database_status: 'Unknown',
      },
      users: { total: 0, active: 0, admins: 0 },
      repositories: {
        total_repositories: 0,
        enabled_repositories: 0,
        disabled_repositories: 0,
        git_repositories: 0,
        gitlab_repositories: 0,
        filesystem_repositories: 0,
        recently_crawled: 0,
        never_crawled: 0,
      },
      content: {
        total_files: 0,
        total_size_bytes: 0,
        recent_additions: 0,
        files_by_extension: [],
        files_by_project: [],
      },
      search: {
        total_documents: 0,
        index_size_mb: 0,
        avg_search_time_ms: null,
        popular_queries: [],
      },
      recent_activity: {
        recent_users: [],
        recent_repositories: [],
        recent_crawls: [],
      },
    };

    mockUseAdminDashboard.mockReturnValue({
      data: zeroData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByDisplayValue('Unknown')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0m')).toBeInTheDocument(); // Zero uptime
    expect(screen.getByDisplayValue('0 Bytes')).toBeInTheDocument(); // Zero bytes
  });

  it('calculates trend percentage correctly', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    // Recent additions trend: 100 / 10000 * 100 = 1%
    const trendElement = screen.getByTestId('metric-trend');
    expect(trendElement).toHaveTextContent('1% vs total');
    expect(trendElement).toHaveAttribute('data-direction', 'up');
  });

  it('formats dates correctly in recent activity', () => {
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    // Should format dates using toLocaleDateString
    const dateElements = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('handles crawl with no last_crawled date', () => {
    const dataWithNeverCrawled = {
      ...mockDashboardData,
      recent_activity: {
        ...mockDashboardData.recent_activity,
        recent_crawls: [
          {
            repository_name: 'never-crawled-repo',
            last_crawled: null,
            status: 'Pending',
          },
        ],
      },
    };

    mockUseAdminDashboard.mockReturnValue({
      data: dataWithNeverCrawled,
      isLoading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByText('never-crawled-repo')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('renders MetricCard components with correct props', () => {
    const MetricCard = vi.mocked(require('../../components/admin/MetricCard').MetricCard);
    
    mockUseAdminDashboard.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
    });

    renderComponent();

    // Verify MetricCard is called with expected props
    expect(MetricCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'System Status',
        value: 'Connected',
        description: 'v1.0.0 • production',
        color: 'green',
      }),
      expect.any(Object)
    );

    expect(MetricCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Recent Files',
        value: 100,
        description: 'Added in last 24h',
        color: 'yellow',
        trend: {
          value: 1,
          direction: 'up',
          label: 'vs total',
        },
      }),
      expect.any(Object)
    );
  });
});