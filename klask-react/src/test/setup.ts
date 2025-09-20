import '@testing-library/jest-dom';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Configure testing-library to be less verbose
configure({
  getElementError: (message) => {
    return new Error(
      [
        message,
        'Tip: Try using a more specific selector or check if the element exists.',
      ].join('\n\n')
    );
  },
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  };
});

// Enhanced timeout for async operations - reduced for better test performance
vi.setConfig({ testTimeout: 5000 });

// Global React Query error handler mock to prevent unhandled promise rejections
global.addEventListener = vi.fn();
global.removeEventListener = vi.fn();

// Mock for React Query's window focus refetching
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false,
});

Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible',
});

// Mock for React Query's network status
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});