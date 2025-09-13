// API Types - matching the Rust backend models

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const UserRole = {
  USER: 'User',
  ADMIN: 'Admin',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface Repository {
  id: string;
  name: string;
  url: string;
  repositoryType: RepositoryType;
  branch?: string;
  enabled: boolean;
  lastCrawled?: string;
  createdAt: string;
  updatedAt: string;
}

export const RepositoryType = {
  GIT: 'Git',
  GITLAB: 'GitLab',
  FILESYSTEM: 'FileSystem',
} as const;

export type RepositoryType = typeof RepositoryType[keyof typeof RepositoryType];

export interface File {
  id: string;
  name: string;
  path: string;
  content?: string;
  project: string;
  version: string;
  extension: string;
  size: number;
  lastModified: string;
  createdAt: string;
  updatedAt: string;
}

// Search Types - matching Rust backend
export interface SearchQuery {
  query: string;
  project?: string;
  version?: string;
  extension?: string;
  maxResults?: number;
  offset?: number;
}

export interface SearchResult {
  file_id: string;
  doc_address: string;
  file_name: string;
  file_path: string;
  content_snippet: string;
  project: string;
  version: string;
  extension: string;
  score: number;
  line_number?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  took?: number;
  page?: number;
  size?: number;
}

// Filter Types - Simple strings for now
export interface SearchFilters {
  projects: string[];
  versions: string[];
  extensions: string[];
}

export interface FilterOption {
  name: string;
  count: number;
  active: boolean;
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TokenClaims {
  sub: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}


// User Management Types
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
  active?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: UserRole;
  active?: boolean;
}

export interface UserStats {
  total: number;
  active: number;
  admins: number;
  users: number;
}

// Repository Management Types
export interface CreateRepositoryRequest {
  name: string;
  url: string;
  repositoryType: RepositoryType;
  branch?: string;
  enabled?: boolean;
  accessToken?: string;
  gitlabNamespace?: string;
  isGroup?: boolean;
}

export interface CrawlStatus {
  repositoryId: string;
  status: 'idle' | 'crawling' | 'completed' | 'error';
  progress?: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
}

// UI State Types
export interface SearchState {
  query: string;
  filters: {
    projects: string[];
    versions: string[];
    extensions: string[];
  };
  pagination: {
    page: number;
    size: number;
    sort: string;
  };
  activeFilters: SearchFilters;
}

export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  loading: boolean;
  errors: string[];
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps extends BaseComponentProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Form Types
export interface FormFieldError {
  message: string;
  type: string;
}

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, FormFieldError>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<any>;
  children?: NavItem[];
  requiresAuth?: boolean;
  requiredRole?: UserRole;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequireField<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Event Types
export interface SearchEvent {
  type: 'search' | 'filter' | 'sort' | 'paginate';
  payload: any;
  timestamp: number;
}

// Hook Return Types
export interface UseSearchReturn {
  results: SearchResult[];
  filters: SearchFilters;
  loading: boolean;
  error: string | null;
  total: number;
  search: (query: SearchQuery) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
}

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export interface UseRepositoriesReturn {
  repositories: Repository[];
  loading: boolean;
  error: string | null;
  create: (data: CreateRepositoryRequest) => Promise<Repository>;
  update: (id: string, data: Partial<Repository>) => Promise<Repository>;
  delete: (id: string) => Promise<void>;
  crawl: (id: string) => Promise<void>;
  refresh: () => void;
}