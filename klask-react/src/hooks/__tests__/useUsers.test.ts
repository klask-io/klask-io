import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithQueryClient } from '../../test/react-query-test-utils';
import React from 'react';
import {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useUpdateUserRole,
  useUpdateUserStatus,
  useDeleteUser,
  useUserStats,
  useBulkUserOperations,
} from '../useUsers';
import { api } from '../../lib/api';
import type { User, CreateUserRequest, UpdateUserRequest, UserRole, UserStats } from '../../types';

// Mock the API
vi.mock('../../lib/api', () => ({
  api: {
    getUsers: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
    deleteUser: vi.fn(),
    getUserStats: vi.fn(),
  },
  getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
}));

const mockApi = api as any;

// Mock console methods
const mockConsole = {
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
};

beforeEach(() => {
  global.console.error = mockConsole.error;
  global.console.log = mockConsole.log;
  global.console.warn = mockConsole.warn;
});

// Test data
const mockUser: User = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'User',
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockUsers: User[] = [
  mockUser,
  {
    id: 'user-2',
    username: 'admin',
    email: 'admin@example.com',
    role: 'Admin',
    active: true,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const mockUserStats: UserStats = {
  total: 10,
  active: 8,
  admins: 2,
  users: 8,
};

const mockCreateUserRequest: CreateUserRequest = {
  username: 'newuser',
  email: 'newuser@example.com',
  password: 'Password123',
  role: 'User',
  active: true,
};

const mockUpdateUserRequest: UpdateUserRequest = {
  username: 'updateduser',
  email: 'updated@example.com',
  role: 'Admin',
  active: false,
};

describe('useUsers hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useUsers', () => {
    it('should fetch and return users list', async () => {
      mockApi.getUsers.mockResolvedValue(mockUsers);

      const { result, queryClient } = renderHookWithQueryClient(() => useUsers());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUsers);
      expect(mockApi.getUsers).toHaveBeenCalledTimes(1);
    });

    it('should handle users fetch error', async () => {
      const mockError = new Error('Failed to fetch users');
      mockApi.getUsers.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUsers());

      // Debug what's happening
      console.log('Initial state:', { 
        isLoading: result.current.isLoading, 
        isError: result.current.isError,
        isSuccess: result.current.isSuccess 
      });

      await waitFor(() => {
        console.log('Waiting state:', { 
          isLoading: result.current.isLoading, 
          isError: result.current.isError,
          isSuccess: result.current.isSuccess,
          status: result.current.status 
        });
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 });

      expect(result.current.error).toBeTruthy();
    });

    it('should use correct stale time and retry settings', async () => {
      mockApi.getUsers.mockResolvedValue(mockUsers);

      const { result, queryClient } = renderHookWithQueryClient(() => useUsers());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the query was configured with correct options
      const queries = queryClient.getQueryCache().findAll(['users']);
      expect(queries).toHaveLength(1);
      expect(queries[0].options.staleTime).toBe(30000); // 30 seconds
      expect(queries[0].options.retry).toBe(2);
    });

    it('should cache users data appropriately', async () => {
      mockApi.getUsers.mockResolvedValue(mockUsers);

      const { result, rerender } = renderHookWithQueryClient(() => useUsers());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Rerender should use cached data
      rerender();
      expect(mockApi.getUsers).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe('useUser', () => {
    it('should fetch single user by id', async () => {
      mockApi.getUser.mockResolvedValue(mockUser);

      const { result, queryClient } = renderHookWithQueryClient(() => useUser('user-1'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUser);
      expect(mockApi.getUser).toHaveBeenCalledWith('user-1');
    });

    it('should not fetch when id is empty', () => {
      const { result, queryClient } = renderHookWithQueryClient(() => useUser(''));

      expect(result.current.data).toBeUndefined();
      expect(mockApi.getUser).not.toHaveBeenCalled();
    });

    it('should handle single user fetch error', async () => {
      const mockError = new Error('User not found');
      mockApi.getUser.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUser('nonexistent'));

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should update query when id changes', async () => {
      mockApi.getUser.mockResolvedValue(mockUser);

      const { result, rerender } = renderHookWithQueryClient(
        ({ id }) => useUser(id),
        { initialProps: { id: 'user-1' } }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApi.getUser).toHaveBeenCalledWith('user-1');

      // Change ID
      const differentUser = { ...mockUser, id: 'user-2' };
      mockApi.getUser.mockResolvedValue(differentUser);

      rerender({ id: 'user-2' });

      await waitFor(() => {
        expect(result.current.data).toEqual(differentUser);
      });

      expect(mockApi.getUser).toHaveBeenCalledWith('user-2');
    });
  });

  describe('useCreateUser', () => {
    it('should create user and invalidate users cache', async () => {
      const newUser = { ...mockUser, id: 'user-new' };
      mockApi.createUser.mockResolvedValue(newUser);

      const { result, queryClient } = renderHookWithQueryClient(() => useCreateUser());

      await result.current.mutateAsync(mockCreateUserRequest);

      expect(mockApi.createUser).toHaveBeenCalledWith(mockCreateUserRequest);
      
      // Should invalidate users query
      const usersQuery = queryClient.getQueryCache().find(['users']);
      expect(usersQuery?.isInvalidated()).toBe(true);
    });

    it('should handle create user error and log it', async () => {
      const mockError = new Error('Username already exists');
      mockApi.createUser.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useCreateUser());

      await expect(result.current.mutateAsync(mockCreateUserRequest))
        .rejects.toThrow('Username already exists');

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to create user:',
        'Username already exists'
      );
    });

    it('should have correct mutation state during creation', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => { resolvePromise = resolve; });
      mockApi.createUser.mockReturnValue(promise);

      const { result, queryClient } = renderHookWithQueryClient(() => useCreateUser());

      // Start mutation
      const mutationPromise = result.current.mutateAsync(mockCreateUserRequest);
      
      // Should be pending
      expect(result.current.isPending).toBe(true);

      // Resolve
      resolvePromise!(mockUser);
      await mutationPromise;

      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('useUpdateUser', () => {
    it('should update user and update cache', async () => {
      const updatedUser = { ...mockUser, username: 'updated' };
      mockApi.updateUser.mockResolvedValue(updatedUser);

      // Pre-populate cache with users
      queryClient.setQueryData(['users'], mockUsers);
      queryClient.setQueryData(['users', mockUser.id], mockUser);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUser());

      await result.current.mutateAsync({ 
        id: mockUser.id, 
        data: mockUpdateUserRequest 
      });

      expect(mockApi.updateUser).toHaveBeenCalledWith(mockUser.id, mockUpdateUserRequest);
      
      // Should update individual user cache
      const cachedUser = queryClient.getQueryData(['users', mockUser.id]);
      expect(cachedUser).toEqual(updatedUser);

      // Should update user in users list
      const cachedUsers = queryClient.getQueryData(['users']) as User[];
      const updatedUserInList = cachedUsers.find(u => u.id === mockUser.id);
      expect(updatedUserInList).toEqual(updatedUser);
    });

    it('should handle update user error and log it', async () => {
      const mockError = new Error('Validation failed');
      mockApi.updateUser.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUser());

      await expect(result.current.mutateAsync({ 
        id: mockUser.id, 
        data: mockUpdateUserRequest 
      })).rejects.toThrow('Validation failed');

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to update user:',
        'Validation failed'
      );
    });

    it('should handle cache update when users list is empty', async () => {
      const updatedUser = { ...mockUser, username: 'updated' };
      mockApi.updateUser.mockResolvedValue(updatedUser);

      // No users in cache
      queryClient.setQueryData(['users'], undefined);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUser());

      await result.current.mutateAsync({ 
        id: mockUser.id, 
        data: mockUpdateUserRequest 
      });

      // Should create new users array with updated user
      const cachedUsers = queryClient.getQueryData(['users']) as User[];
      expect(cachedUsers).toEqual([updatedUser]);
    });
  });

  describe('useUpdateUserRole', () => {
    it('should update user role and update cache', async () => {
      const updatedUser = { ...mockUser, role: 'Admin' as UserRole };
      mockApi.updateUserRole.mockResolvedValue(updatedUser);

      queryClient.setQueryData(['users'], mockUsers);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUserRole());

      await result.current.mutateAsync({ 
        id: mockUser.id, 
        role: 'Admin' 
      });

      expect(mockApi.updateUserRole).toHaveBeenCalledWith(mockUser.id, 'Admin');
      
      const cachedUser = queryClient.getQueryData(['users', mockUser.id]);
      expect(cachedUser).toEqual(updatedUser);
    });

    it('should handle role update error and log it', async () => {
      const mockError = new Error('Insufficient permissions');
      mockApi.updateUserRole.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUserRole());

      await expect(result.current.mutateAsync({ 
        id: mockUser.id, 
        role: 'Admin' 
      })).rejects.toThrow('Insufficient permissions');

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to update user role:',
        'Insufficient permissions'
      );
    });
  });

  describe('useUpdateUserStatus', () => {
    it('should update user status and update cache', async () => {
      const updatedUser = { ...mockUser, active: false };
      mockApi.updateUserStatus.mockResolvedValue(updatedUser);

      queryClient.setQueryData(['users'], mockUsers);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUserStatus());

      await result.current.mutateAsync({ 
        id: mockUser.id, 
        active: false 
      });

      expect(mockApi.updateUserStatus).toHaveBeenCalledWith(mockUser.id, false);
      
      const cachedUser = queryClient.getQueryData(['users', mockUser.id]);
      expect(cachedUser).toEqual(updatedUser);
    });

    it('should handle status update error and log it', async () => {
      const mockError = new Error('Cannot deactivate admin user');
      mockApi.updateUserStatus.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUserStatus());

      await expect(result.current.mutateAsync({ 
        id: mockUser.id, 
        active: false 
      })).rejects.toThrow('Cannot deactivate admin user');

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to update user status:',
        'Cannot deactivate admin user'
      );
    });
  });

  describe('useDeleteUser', () => {
    it('should delete user and update cache', async () => {
      mockApi.deleteUser.mockResolvedValue(undefined);

      queryClient.setQueryData(['users'], mockUsers);
      queryClient.setQueryData(['users', mockUser.id], mockUser);

      const { result, queryClient } = renderHookWithQueryClient(() => useDeleteUser());

      await result.current.mutateAsync(mockUser.id);

      expect(mockApi.deleteUser).toHaveBeenCalledWith(mockUser.id);
      
      // Should remove user from list
      const cachedUsers = queryClient.getQueryData(['users']) as User[];
      expect(cachedUsers).toHaveLength(1);
      expect(cachedUsers.find(u => u.id === mockUser.id)).toBeUndefined();

      // Should remove individual user query
      const userQuery = queryClient.getQueryCache().find(['users', mockUser.id]);
      expect(userQuery).toBeUndefined();
    });

    it('should handle delete user error and log it', async () => {
      const mockError = new Error('Cannot delete last admin');
      mockApi.deleteUser.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useDeleteUser());

      await expect(result.current.mutateAsync(mockUser.id))
        .rejects.toThrow('Cannot delete last admin');

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to delete user:',
        'Cannot delete last admin'
      );
    });

    it('should handle cache update when users list is empty', async () => {
      mockApi.deleteUser.mockResolvedValue(undefined);

      queryClient.setQueryData(['users'], undefined);

      const { result, queryClient } = renderHookWithQueryClient(() => useDeleteUser());

      await result.current.mutateAsync(mockUser.id);

      // Should set empty array
      const cachedUsers = queryClient.getQueryData(['users']) as User[];
      expect(cachedUsers).toEqual([]);
    });
  });

  describe('useUserStats', () => {
    it('should fetch user statistics', async () => {
      mockApi.getUserStats.mockResolvedValue(mockUserStats);

      const { result, queryClient } = renderHookWithQueryClient(() => useUserStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUserStats);
      expect(mockApi.getUserStats).toHaveBeenCalledTimes(1);
    });

    it('should use correct cache settings for stats', async () => {
      mockApi.getUserStats.mockResolvedValue(mockUserStats);

      const { result, queryClient } = renderHookWithQueryClient(() => useUserStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const queries = queryClient.getQueryCache().findAll(['users', 'stats']);
      expect(queries).toHaveLength(1);
      expect(queries[0].options.staleTime).toBe(60000); // 1 minute
      expect(queries[0].options.retry).toBe(2);
    });

    it('should handle stats fetch error', async () => {
      const mockError = new Error('Stats calculation failed');
      mockApi.getUserStats.mockRejectedValue(mockError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUserStats());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useBulkUserOperations', () => {
    let bulkHook: any;

    beforeEach(() => {
      const { result, queryClient } = renderHookWithQueryClient(() => useBulkUserOperations());
      bulkHook = result.current;
    });

    describe('bulkActivate', () => {
      it('should activate multiple users and invalidate cache', async () => {
        const userIds = ['user-1', 'user-2', 'user-3'];
        const activatedUsers = userIds.map(id => ({ ...mockUser, id, active: true }));
        
        mockApi.updateUserStatus.mockImplementation((id: string, active: boolean) => 
          Promise.resolve({ ...mockUser, id, active })
        );

        await bulkHook.bulkActivate.mutateAsync(userIds);

        expect(mockApi.updateUserStatus).toHaveBeenCalledTimes(3);
        userIds.forEach(id => {
          expect(mockApi.updateUserStatus).toHaveBeenCalledWith(id, true);
        });

        const usersQuery = queryClient.getQueryCache().find(['users']);
        expect(usersQuery?.isInvalidated()).toBe(true);
      });

      it('should handle bulk activate errors', async () => {
        const userIds = ['user-1', 'user-2'];
        mockApi.updateUserStatus.mockRejectedValue(new Error('Bulk operation failed'));

        await expect(bulkHook.bulkActivate.mutateAsync(userIds))
          .rejects.toThrow('Bulk operation failed');
      });

      it('should handle partial failures in bulk activate', async () => {
        const userIds = ['user-1', 'user-2'];
        mockApi.updateUserStatus
          .mockResolvedValueOnce({ ...mockUser, id: 'user-1', active: true })
          .mockRejectedValueOnce(new Error('User 2 failed'));

        await expect(bulkHook.bulkActivate.mutateAsync(userIds))
          .rejects.toThrow('User 2 failed');
      });
    });

    describe('bulkDeactivate', () => {
      it('should deactivate multiple users and invalidate cache', async () => {
        const userIds = ['user-1', 'user-2'];
        
        mockApi.updateUserStatus.mockImplementation((id: string, active: boolean) => 
          Promise.resolve({ ...mockUser, id, active })
        );

        await bulkHook.bulkDeactivate.mutateAsync(userIds);

        expect(mockApi.updateUserStatus).toHaveBeenCalledTimes(2);
        userIds.forEach(id => {
          expect(mockApi.updateUserStatus).toHaveBeenCalledWith(id, false);
        });

        const usersQuery = queryClient.getQueryCache().find(['users']);
        expect(usersQuery?.isInvalidated()).toBe(true);
      });
    });

    describe('bulkSetRole', () => {
      it('should set role for multiple users and invalidate cache', async () => {
        const userIds = ['user-1', 'user-2'];
        const role = 'Admin';
        
        mockApi.updateUserRole.mockImplementation((id: string, role: UserRole) => 
          Promise.resolve({ ...mockUser, id, role })
        );

        await bulkHook.bulkSetRole.mutateAsync({ userIds, role });

        expect(mockApi.updateUserRole).toHaveBeenCalledTimes(2);
        userIds.forEach(id => {
          expect(mockApi.updateUserRole).toHaveBeenCalledWith(id, role);
        });

        const usersQuery = queryClient.getQueryCache().find(['users']);
        expect(usersQuery?.isInvalidated()).toBe(true);
      });

      it('should handle bulk role update errors', async () => {
        const userIds = ['user-1'];
        const role = 'Admin';
        mockApi.updateUserRole.mockRejectedValue(new Error('Role update failed'));

        await expect(bulkHook.bulkSetRole.mutateAsync({ userIds, role }))
          .rejects.toThrow('Role update failed');
      });
    });

    describe('bulkDelete', () => {
      it('should delete multiple users and invalidate cache', async () => {
        const userIds = ['user-1', 'user-2'];
        
        mockApi.deleteUser.mockResolvedValue(undefined);

        await bulkHook.bulkDelete.mutateAsync(userIds);

        expect(mockApi.deleteUser).toHaveBeenCalledTimes(2);
        userIds.forEach(id => {
          expect(mockApi.deleteUser).toHaveBeenCalledWith(id);
        });

        const usersQuery = queryClient.getQueryCache().find(['users']);
        expect(usersQuery?.isInvalidated()).toBe(true);
      });

      it('should handle bulk delete errors', async () => {
        const userIds = ['user-1'];
        mockApi.deleteUser.mockRejectedValue(new Error('Delete operation failed'));

        await expect(bulkHook.bulkDelete.mutateAsync(userIds))
          .rejects.toThrow('Delete operation failed');
      });
    });

    it('should return all bulk operation mutations', () => {
      expect(bulkHook.bulkActivate).toBeDefined();
      expect(bulkHook.bulkDeactivate).toBeDefined();
      expect(bulkHook.bulkSetRole).toBeDefined();
      expect(bulkHook.bulkDelete).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should properly invalidate related queries on mutations', async () => {
      mockApi.createUser.mockResolvedValue(mockUser);
      
      // Pre-populate stats cache
      queryClient.setQueryData(['users', 'stats'], mockUserStats);

      const { result, queryClient } = renderHookWithQueryClient(() => useCreateUser());

      await result.current.mutateAsync(mockCreateUserRequest);

      // Both users and stats queries should be invalidated
      const usersQuery = queryClient.getQueryCache().find(['users']);
      const statsQuery = queryClient.getQueryCache().find(['users', 'stats']);
      
      expect(usersQuery?.isInvalidated()).toBe(true);
    });

    it('should handle optimistic updates correctly', async () => {
      const updatedUser = { ...mockUser, username: 'optimistic' };
      
      // Simulate slow network
      let resolveUpdate: (value: any) => void;
      const updatePromise = new Promise(resolve => { resolveUpdate = resolve; });
      mockApi.updateUser.mockReturnValue(updatePromise);

      queryClient.setQueryData(['users'], mockUsers);
      queryClient.setQueryData(['users', mockUser.id], mockUser);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUser());

      const mutationPromise = result.current.mutateAsync({ 
        id: mockUser.id, 
        data: { username: 'optimistic' }
      });

      // Resolve the API call
      resolveUpdate!(updatedUser);
      await mutationPromise;

      const cachedUser = queryClient.getQueryData(['users', mockUser.id]);
      expect(cachedUser).toEqual(updatedUser);
    });

    it('should handle concurrent mutations correctly', async () => {
      const user1Updated = { ...mockUser, username: 'concurrent1' };
      const user2Updated = { ...mockUsers[1], username: 'concurrent2' };

      mockApi.updateUser
        .mockResolvedValueOnce(user1Updated)
        .mockResolvedValueOnce(user2Updated);

      queryClient.setQueryData(['users'], mockUsers);

      const { result, queryClient } = renderHookWithQueryClient(() => useUpdateUser());

      // Start concurrent updates
      const promise1 = result.current.mutateAsync({ 
        id: mockUser.id, 
        data: { username: 'concurrent1' }
      });

      const promise2 = result.current.mutateAsync({ 
        id: mockUsers[1].id, 
        data: { username: 'concurrent2' }
      });

      await Promise.all([promise1, promise2]);

      const cachedUsers = queryClient.getQueryData(['users']) as User[];
      expect(cachedUsers.find(u => u.id === mockUser.id)?.username).toBe('concurrent1');
      expect(cachedUsers.find(u => u.id === mockUsers[1].id)?.username).toBe('concurrent2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      mockApi.getUsers.mockRejectedValue(networkError);

      const { result, queryClient } = renderHookWithQueryClient(() => useUsers());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(networkError);
    });

    it('should handle malformed API responses', async () => {
      mockApi.getUsers.mockResolvedValue(null);

      const { result, queryClient } = renderHookWithQueryClient(() => useUsers());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('should handle empty user arrays correctly', async () => {
      mockApi.getUsers.mockResolvedValue([]);

      const { result, queryClient } = renderHookWithQueryClient(() => useUsers());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should handle missing user properties gracefully', async () => {
      const incompleteUser = { id: 'incomplete', username: 'test' } as any;
      mockApi.getUser.mockResolvedValue(incompleteUser);

      const { result, queryClient } = renderHookWithQueryClient(() => useUser('incomplete'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(incompleteUser);
    });

    it('should handle rapid successive API calls', async () => {
      mockApi.getUsers.mockResolvedValue(mockUsers);

      const { result, rerender } = renderHookWithQueryClient(() => useUsers());

      // Rapidly trigger multiple rerenders
      for (let i = 0; i < 5; i++) {
        rerender();
      }

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should only make one API call due to caching
      expect(mockApi.getUsers).toHaveBeenCalledTimes(1);
    });
  });
});