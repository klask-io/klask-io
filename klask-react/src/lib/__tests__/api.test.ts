import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError, api } from '../api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

describe('API Client - stopCrawlRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockResponse = (data: any, status = 200, ok = true) => ({
    ok,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  });

  describe('stopCrawlRepository method', () => {
    it('should make DELETE request to correct endpoint', async () => {
      const repositoryId = 'repo-123';
      const mockResponseData = { message: 'Crawl stopped successfully' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponseData));

      const result = await apiClient.stopCrawlRepository(repositoryId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/repositories/repo-123/crawl',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result).toEqual(mockResponseData);
    });

    it('should include authorization header when token is present', async () => {
      const repositoryId = 'repo-456';
      const token = 'valid-auth-token';
      localStorageMock.getItem.mockReturnValue(token);
      
      // Create new client instance to pick up token
      const apiInstance = new (apiClient.constructor as any)('http://localhost:3000');
      apiInstance.setToken(token);
      
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Success' }));

      await apiInstance.stopCrawlRepository(repositoryId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-auth-token',
          }),
        })
      );
    });

    it('should handle successful response', async () => {
      const repositoryId = 'repo-789';
      const mockResponse = { message: 'Crawl stopped successfully' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await apiClient.stopCrawlRepository(repositoryId);

      expect(result).toEqual(mockResponse);
    });

    it('should handle 404 error (repository not crawling)', async () => {
      const repositoryId = 'repo-not-crawling';
      const errorResponse = { error: 'Repository not currently crawling' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 404, false));

      await expect(apiClient.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow(ApiError);

      try {
        await apiClient.stopCrawlRepository(repositoryId);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).message).toBe('Repository not currently crawling');
      }
    });

    it('should handle 401 unauthorized error', async () => {
      const repositoryId = 'repo-unauthorized';
      const errorResponse = { error: 'Unauthorized' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 401, false));

      await expect(apiClient.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow(ApiError);

      try {
        await apiClient.stopCrawlRepository(repositoryId);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
      }
    });

    it('should handle 500 server error', async () => {
      const repositoryId = 'repo-server-error';
      const errorResponse = { error: 'Internal server error' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 500, false));

      await expect(apiClient.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow(ApiError);

      try {
        await apiClient.stopCrawlRepository(repositoryId);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
      }
    });

    it('should handle network errors', async () => {
      const repositoryId = 'repo-network-error';
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      const repositoryId = 'repo-malformed-json';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => { throw new Error('Invalid JSON'); },
        text: async () => 'Invalid JSON response',
      });

      await expect(apiClient.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow();
    });

    it('should handle empty repository ID', async () => {
      const emptyId = '';
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Invalid repository ID' }, 400, false));

      await expect(apiClient.stopCrawlRepository(emptyId))
        .rejects
        .toThrow(ApiError);
    });

    it('should handle special characters in repository ID', async () => {
      const specialId = 'repo@#$%^&*()';
      const mockResponse = { message: 'Success' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      await apiClient.stopCrawlRepository(specialId);

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/repositories/${encodeURIComponent(specialId)}/crawl`,
        expect.any(Object)
      );
    });

    it('should handle timeout errors', async () => {
      const repositoryId = 'repo-timeout';
      
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(apiClient.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow('Request timeout');
    });

    it('should work without authentication token', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      // Create client without token
      const clientWithoutToken = new (apiClient.constructor as any)('http://localhost:3000');
      const repositoryId = 'repo-no-auth';
      
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Unauthorized' }, 401, false));

      await expect(clientWithoutToken.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow(ApiError);
    });

    it('should use correct HTTP method', async () => {
      const repositoryId = 'repo-method-test';
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Success' }));

      await apiClient.stopCrawlRepository(repositoryId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should include proper headers', async () => {
      const repositoryId = 'repo-headers';
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Success' }));

      await apiClient.stopCrawlRepository(repositoryId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle response with different message formats', async () => {
      const repositoryId = 'repo-message-format';
      const responses = [
        { message: 'Crawl stopped' },
        { message: 'Successfully stopped crawling' },
        { status: 'stopped' },
        'Crawl stopped', // String response
      ];

      for (const response of responses) {
        mockFetch.mockResolvedValueOnce(createMockResponse(response));
        const result = await apiClient.stopCrawlRepository(repositoryId);
        expect(result).toEqual(response);
      }
    });
  });

  describe('API wrapper - stopCrawlRepository', () => {
    it('should call apiClient.stopCrawlRepository', async () => {
      const repositoryId = 'repo-wrapper-test';
      const mockResponse = { message: 'Crawl stopped via wrapper' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await api.stopCrawlRepository(repositoryId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/repositories/${repositoryId}/crawl`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should propagate errors from apiClient', async () => {
      const repositoryId = 'repo-wrapper-error';
      
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Test error' }, 500, false));

      await expect(api.stopCrawlRepository(repositoryId))
        .rejects
        .toThrow(ApiError);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle concurrent requests', async () => {
      const repositoryIds = ['repo-1', 'repo-2', 'repo-3'];
      const mockResponses = repositoryIds.map((id, index) => ({
        message: `Stopped crawl for ${id}`,
        id: index,
      }));

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockResponses[0]))
        .mockResolvedValueOnce(createMockResponse(mockResponses[1]))
        .mockResolvedValueOnce(createMockResponse(mockResponses[2]));

      const promises = repositoryIds.map(id => apiClient.stopCrawlRepository(id));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure responses', async () => {
      const repositoryIds = ['repo-success', 'repo-failure'];
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ message: 'Success' }))
        .mockResolvedValueOnce(createMockResponse({ error: 'Failure' }, 500, false));

      const results = await Promise.allSettled([
        apiClient.stopCrawlRepository(repositoryIds[0]),
        apiClient.stopCrawlRepository(repositoryIds[1]),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });

    it('should preserve error details in ApiError', async () => {
      const repositoryId = 'repo-detailed-error';
      const errorResponse = {
        error: 'Validation failed',
        details: {
          field: 'repository_id',
          reason: 'Repository not found',
        },
      };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 400, false));

      try {
        await apiClient.stopCrawlRepository(repositoryId);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).details).toEqual(errorResponse);
        expect((error as ApiError).status).toBe(400);
      }
    });

    it('should handle very long repository IDs', async () => {
      const longId = 'a'.repeat(1000);
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Success' }));

      await apiClient.stopCrawlRepository(longId);

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/repositories/${longId}/crawl`,
        expect.any(Object)
      );
    });

    it('should handle UUID format repository IDs', async () => {
      const uuidId = '123e4567-e89b-12d3-a456-426614174000';
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'UUID Success' }));

      const result = await apiClient.stopCrawlRepository(uuidId);

      expect(result.message).toBe('UUID Success');
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/repositories/${uuidId}/crawl`,
        expect.any(Object)
      );
    });
  });
});