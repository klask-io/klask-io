import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Helper to create a query client for tests
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Mock API responses
export const mockApiResponse = <T,>(data: T): Response =>
  ({
    json: () => Promise.resolve(data),
    ok: true,
    status: 200,
  } as Response);

export const mockApiError = (status = 500, message = 'API Error'): Response =>
  ({
    json: () => Promise.resolve({ message }),
    ok: false,
    status,
  } as Response);

// Helper to wait for async operations (renamed to avoid conflict with @testing-library/react waitFor)
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));