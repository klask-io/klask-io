import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import type { User, CreateUserRequest, UpdateUserRequest, UserRole } from '../types';

// Get all users
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};

// Get single user
export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => api.getUser(id),
    enabled: !!id,
    staleTime: 30000,
    retry: 2,
  });
};

// Create user mutation
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateUserRequest) => api.createUser(data),
    onSuccess: () => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      console.error('Failed to create user:', getErrorMessage(error));
    },
  });
};

// Update user mutation
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) => 
      api.updateUser(id, data),
    onSuccess: (updatedUser) => {
      // Update the specific user in cache
      queryClient.setQueryData(['users', updatedUser.id], updatedUser);
      
      // Update the user in the list
      queryClient.setQueryData(['users'], (old: User[] | undefined) => {
        if (!old) return [updatedUser];
        return old.map(user => user.id === updatedUser.id ? updatedUser : user);
      });
    },
    onError: (error) => {
      console.error('Failed to update user:', getErrorMessage(error));
    },
  });
};

// Update user role mutation
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => 
      api.updateUserRole(id, role),
    onSuccess: (updatedUser) => {
      // Update the specific user in cache
      queryClient.setQueryData(['users', updatedUser.id], updatedUser);
      
      // Update the user in the list
      queryClient.setQueryData(['users'], (old: User[] | undefined) => {
        if (!old) return [updatedUser];
        return old.map(user => user.id === updatedUser.id ? updatedUser : user);
      });
    },
    onError: (error) => {
      console.error('Failed to update user role:', getErrorMessage(error));
    },
  });
};

// Update user status mutation
export const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => 
      api.updateUserStatus(id, active),
    onSuccess: (updatedUser) => {
      // Update the specific user in cache
      queryClient.setQueryData(['users', updatedUser.id], updatedUser);
      
      // Update the user in the list
      queryClient.setQueryData(['users'], (old: User[] | undefined) => {
        if (!old) return [updatedUser];
        return old.map(user => user.id === updatedUser.id ? updatedUser : user);
      });
    },
    onError: (error) => {
      console.error('Failed to update user status:', getErrorMessage(error));
    },
  });
};

// Delete user mutation
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: (_, deletedId) => {
      // Remove from users list
      queryClient.setQueryData(['users'], (old: User[] | undefined) => {
        if (!old) return [];
        return old.filter(user => user.id !== deletedId);
      });
      
      // Remove individual user cache
      queryClient.removeQueries({ queryKey: ['users', deletedId] });
    },
    onError: (error) => {
      console.error('Failed to delete user:', getErrorMessage(error));
    },
  });
};

// User statistics
export const useUserStats = () => {
  return useQuery({
    queryKey: ['users', 'stats'],
    queryFn: () => api.getUserStats(),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// Bulk operations
export const useBulkUserOperations = () => {
  const queryClient = useQueryClient();
  
  const bulkActivate = useMutation({
    mutationFn: async (userIds: string[]) => {
      const promises = userIds.map(id => 
        api.updateUserStatus(id, true)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  
  const bulkDeactivate = useMutation({
    mutationFn: async (userIds: string[]) => {
      const promises = userIds.map(id => 
        api.updateUserStatus(id, false)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  
  const bulkSetRole = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: UserRole }) => {
      const promises = userIds.map(id => api.updateUserRole(id, role));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  
  const bulkDelete = useMutation({
    mutationFn: async (userIds: string[]) => {
      const promises = userIds.map(id => api.deleteUser(id));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  
  return {
    bulkActivate,
    bulkDeactivate,
    bulkSetRole,
    bulkDelete,
  };
};