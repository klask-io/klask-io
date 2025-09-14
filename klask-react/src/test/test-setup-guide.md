# Klask React Test Setup Guide

This guide explains how to run and configure tests for the Klask React frontend application.

## Test Framework

The project uses **Vitest** as the test runner with the following setup:
- **Testing Library React** for component testing
- **User Event** for simulating user interactions
- **MSW (Mock Service Worker)** for API mocking
- **JSDOM** as the test environment

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test File Patterns

Tests should be placed in one of these locations:
- `src/**/__tests__/**/*.{test,spec}.{js,ts,tsx}`
- `src/**/*.{test,spec}.{js,ts,tsx}`

## Test Configuration

### Vitest Configuration (`vite.config.ts`)

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  css: true,
}
```

### Setup File (`src/test/setup.ts`)

The setup file configures:
- Jest DOM matchers
- Global test utilities
- Mock configurations

## Testing Utilities

### Custom Test Utils (`src/test/test-utils.tsx`)

Provides wrapper components for testing:
- QueryClient wrapper
- Router wrapper
- Combined providers

### Mock Utilities (`src/test/utils.tsx`)

Common mocking functions for:
- API responses
- User authentication
- External dependencies

## Test Categories

### 1. Unit Tests
Test individual components and functions in isolation.

**Example: Component Unit Test**
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
```

### 2. Integration Tests
Test component interactions and data flow.

**Example: Integration Test**
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyFeature from '../MyFeature';

describe('MyFeature Integration', () => {
  it('handles user workflow correctly', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <MyFeature />
      </QueryClientProvider>
    );
    
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});
```

### 3. Component Tests
Test React components with props, state, and user interactions.

**Key Testing Patterns:**
- Test component rendering
- Test user interactions
- Test prop variations
- Test error states
- Test loading states

## Mocking Strategies

### 1. Module Mocking
Mock entire modules using `vi.mock()`:

```typescript
vi.mock('../../../lib/api', () => ({
  apiClient: {
    getFile: vi.fn(),
    getFileByDocAddress: vi.fn(),
  },
}));
```

### 2. Function Mocking
Mock specific functions:

```typescript
const mockFunction = vi.fn();
mockFunction.mockReturnValue('mocked value');
mockFunction.mockResolvedValue(Promise.resolve('async value'));
```

### 3. Component Mocking
Mock React components:

```typescript
vi.mock('../OptimizedSyntaxHighlighter', () => ({
  default: vi.fn(({ children, language }) => (
    <div data-testid="syntax-highlighter" data-language={language}>
      {children}
    </div>
  )),
}));
```

## Testing Best Practices

### 1. Test Structure
- Use descriptive test names
- Group related tests with `describe`
- Use `beforeEach` for setup
- Clean up after tests

### 2. Assertions
- Test user-visible behavior
- Use semantic queries (`getByRole`, `getByLabelText`)
- Test error conditions
- Verify accessibility

### 3. Async Testing
- Use `waitFor` for async operations
- Test loading states
- Handle timeouts appropriately

### 4. Mocking Guidelines
- Mock external dependencies
- Keep mocks simple and focused
- Reset mocks between tests
- Mock at the right level

## Coverage Guidelines

Aim for high coverage in these areas:
- Critical user paths
- Error handling
- Edge cases
- Complex logic

### Coverage Thresholds
```typescript
// vitest.config.ts
test: {
  coverage: {
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
}
```

## Debugging Tests

### 1. Debug Failed Tests
```bash
# Run specific test file
npm test -- OptimizedSyntaxHighlighter.test.tsx

# Run with verbose output
npm test -- --reporter=verbose

# Run in debug mode
npm test -- --inspect-brk
```

### 2. Console Output
Use `screen.debug()` to see DOM output:

```typescript
import { screen } from '@testing-library/react';

it('debugs component', () => {
  render(<MyComponent />);
  screen.debug(); // Prints current DOM
});
```

### 3. Test Isolation
Ensure tests don't affect each other:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset any global state
});
```

## Common Test Scenarios

### 1. Testing Form Interactions
```typescript
const user = userEvent.setup();
await user.type(screen.getByLabelText('Email'), 'test@example.com');
await user.click(screen.getByRole('button', { name: /submit/i }));
```

### 2. Testing API Calls
```typescript
vi.mocked(apiClient.getData).mockResolvedValue(mockData);
// Trigger component that calls API
await waitFor(() => {
  expect(apiClient.getData).toHaveBeenCalledWith(expectedParams);
});
```

### 3. Testing Error States
```typescript
vi.mocked(apiClient.getData).mockRejectedValue(new Error('API Error'));
// Trigger component
await waitFor(() => {
  expect(screen.getByText('Error loading data')).toBeInTheDocument();
});
```

### 4. Testing Loading States
```typescript
// Mock never-resolving promise for loading state
vi.mocked(apiClient.getData).mockImplementation(() => new Promise(() => {}));
render(<MyComponent />);
expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
```

## Performance Testing

### 1. Component Rendering Performance
```typescript
import { performance } from 'perf_hooks';

it('renders efficiently', () => {
  const start = performance.now();
  render(<LargeComponent data={largeDataSet} />);
  const end = performance.now();
  
  expect(end - start).toBeLessThan(100); // 100ms threshold
});
```

### 2. Memory Leak Detection
```typescript
it('cleans up properly', () => {
  const { unmount } = render(<MyComponent />);
  // Trigger operations
  unmount();
  // Verify cleanup
});
```

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Run Tests
  run: npm test -- --coverage --reporter=junit
  
- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout: `vi.setTimeout(10000)`
   - Check for unresolved promises

2. **Mock not working**
   - Verify mock path is correct
   - Check mock is called before import

3. **DOM queries failing**
   - Use `screen.debug()` to inspect DOM
   - Check element timing with `waitFor`

4. **Async issues**
   - Use `waitFor` for DOM changes
   - Mock timers if needed: `vi.useFakeTimers()`

### Getting Help

- Check Vitest documentation
- Review Testing Library guides
- Look at existing test examples
- Ask team for code review

## Test Examples

The codebase includes comprehensive test examples:

- **Unit Tests**: `src/components/ui/__tests__/`
- **Integration Tests**: `src/features/__tests__/`
- **Utility Tests**: `src/lib/__tests__/`

Refer to these examples for patterns and best practices.