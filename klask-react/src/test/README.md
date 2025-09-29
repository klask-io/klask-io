# React Query Testing Best Practices

This directory contains utilities and configurations for testing React Query hooks and components in the klask-react application.

## Files Overview

### Core Files
- `setup.ts` - Global test setup and configuration
- `test-utils.tsx` - Basic test utilities with providers
- `utils.tsx` - Additional utilities and mock helpers

### Specialized Utilities
- `react-query-test-utils.tsx` - Enhanced React Query testing utilities
- `progress-test-utils.ts` - Specialized utilities for progress/polling functionality

## Common Issues & Solutions

### 1. QueryClient Provider Issues

**Problem**: Tests fail because components using React Query hooks are not wrapped with QueryClientProvider.

**Solution**: Use the provided test utilities:

```typescript
import { renderHookWithQueryClient } from '../test/react-query-test-utils';

// For hooks
const { result, queryClient } = renderHookWithQueryClient(() => useMyHook());

// For components
import { render } from '../test/test-utils'; // This includes QueryClientProvider
render(<MyComponent />);
```

### 2. Mock Return Value Issues

**Problem**: Mocked React Query hooks return incorrect data structure.

**Solution**: Use the mock creators:

```typescript
import { createMockQuery, createMockMutation } from '../test/react-query-test-utils';

// Mock query
const mockQuery = createMockQuery(mockData, {
  isLoading: false,
  isSuccess: true,
});

// Mock mutation
const mockMutation = createMockMutation({
  isPending: false,
  mutateAsync: vi.fn().mockResolvedValue(mockResult),
});
```

### 3. Timeout Issues in Progress Tests

**Problem**: Tests timeout when testing polling/progress functionality.

**Solution**: Use the progress test utilities:

```typescript
import { ProgressTestTimer, MockProgressAPI } from '../test/progress-test-utils';

describe('Progress Tests', () => {
  let timer: ProgressTestTimer;
  let mockAPI: MockProgressAPI;

  beforeEach(() => {
    timer = new ProgressTestTimer();
    timer.mockTimers();
    
    mockAPI = new MockProgressAPI();
    // Set up mock responses
    mockAPI.setRepositoryProgress('repo-1', progressSequence);
  });

  afterEach(() => {
    timer.cleanup();
    mockAPI.reset();
  });
});
```

### 4. Async Operation Testing

**Problem**: Tests complete before async operations finish.

**Solution**: Properly wait for operations:

```typescript
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(result.current.isSuccess).toBe(true);
});

// Or use the helper assertions
import { expectQueryToBeSuccess } from '../test/react-query-test-utils';
expectQueryToBeSuccess(result.current, expectedData);
```

### 5. Cache Persistence Between Tests

**Problem**: Query cache persists between tests causing interference.

**Solution**: Use fresh QueryClient for each test:

```typescript
import { createTestQueryClient } from '../test/react-query-test-utils';

beforeEach(() => {
  const queryClient = createTestQueryClient();
  // Use this client for your test
});
```

## Best Practices

### 1. Always Mock API Calls

```typescript
// Good
vi.mock('../../lib/api', () => ({
  api: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
  },
}));

const mockApi = api as any;
mockApi.getUsers.mockResolvedValue(mockData);
```

### 2. Use Proper Query Client Configuration

```typescript
// Good - Disable retries and refetching for tests
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
```

### 3. Test All Hook States

```typescript
// Test loading state
expect(result.current.isLoading).toBe(true);

// Test success state
await waitFor(() => {
  expect(result.current.isSuccess).toBe(true);
  expect(result.current.data).toEqual(expectedData);
});

// Test error state
await waitFor(() => {
  expect(result.current.isError).toBe(true);
  expect(result.current.error).toBeTruthy();
});
```

### 4. Clean Up After Tests

```typescript
afterEach(() => {
  vi.clearAllMocks();
  // Clear timers if using fake timers
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});
```

### 5. Handle Progress/Polling Tests Carefully

```typescript
// Use fake timers for polling tests
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

// Advance timers to trigger polling
act(() => {
  vi.advanceTimersByTime(1000);
});
```

## Testing Patterns

### Hook Testing Pattern

```typescript
import { renderHookWithQueryClient } from '../test/react-query-test-utils';

const { result, queryClient } = renderHookWithQueryClient(() => 
  useMyHook(params)
);

await waitFor(() => {
  expect(result.current.isSuccess).toBe(true);
});
```

### Component Testing Pattern

```typescript
import { render, screen } from '../test/test-utils';

render(<MyComponent />);

await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Mutation Testing Pattern

```typescript
const { result } = renderHookWithQueryClient(() => useMyMutation());

await act(async () => {
  await result.current.mutateAsync(inputData);
});

expect(result.current.isSuccess).toBe(true);
expect(mockApi.createItem).toHaveBeenCalledWith(inputData);
```

## Common Gotchas

1. **Don't forget to await async operations** - Always use `waitFor` or `act` with async operations
2. **Mock all external dependencies** - API calls, timers, browser APIs
3. **Use stable query keys** - Ensure query keys in tests match those in implementation
4. **Clear mocks between tests** - Use `vi.clearAllMocks()` in beforeEach
5. **Handle cleanup properly** - Clear timers, subscriptions, and query cache

## Debugging Tips

1. **Check mock call counts**: `expect(mockApi.getUsers).toHaveBeenCalledTimes(1)`
2. **Inspect query cache**: Use the returned `queryClient` to inspect cache state
3. **Add debug logs**: Use `console.log` temporarily to understand execution flow
4. **Use React Query DevTools** in development to understand query behavior
5. **Check for unhandled promise rejections** in test output

## Migration Notes

If you're updating existing tests:

1. Replace direct QueryClient instantiation with `createTestQueryClient()`
2. Use the new mock creators instead of manual mock objects
3. Replace custom waitFor functions with the provided utilities
4. Add proper cleanup in afterEach hooks
5. Use the progress test utilities for any progress/polling related tests