import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { UserRole } from '../types';
import { apiClient, decodeToken, isTokenExpired } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  checkTokenValidity: () => boolean;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },

      setToken: (token) => {
        set({ token });
        apiClient.setToken(token);
        
        // Decode token to check validity
        if (token) {
          const isValid = get().checkTokenValidity();
          if (!isValid) {
            get().logout();
          }
        }
      },

      login: (token, user) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        apiClient.setToken(token);
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        apiClient.logout();
      },

      refreshUser: async () => {
        const { token } = get();
        if (!token) return;

        try {
          set({ isLoading: true });
          const user = await apiClient.getProfile();
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error('Failed to refresh user:', error);
          get().logout();
        } finally {
          set({ isLoading: false });
        }
      },

      checkTokenValidity: () => {
        const { token } = get();
        if (!token) return false;

        try {
          return !isTokenExpired(token);
        } catch {
          return false;
        }
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        apiClient.logout();
      },
    }),
    {
      name: 'klask-auth',
      partialize: (state) => ({ 
        token: state.token,
        user: state.user 
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          // Set token in API client
          apiClient.setToken(state.token);
          
          // Check token validity on rehydration
          const isValid = !isTokenExpired(state.token);
          if (!isValid) {
            state.clearAuth();
          } else {
            // Token is valid, refresh user data
            state.refreshUser();
          }
        }
      },
    }
  )
);

// Selectors for convenient access to auth state
export const authSelectors = {
  isAuthenticated: () => useAuthStore((state) => state.isAuthenticated),
  user: () => useAuthStore((state) => state.user),
  token: () => useAuthStore((state) => state.token),
  isLoading: () => useAuthStore((state) => state.isLoading),
  isAdmin: () => useAuthStore((state) => state.user?.role === UserRole.ADMIN),
  hasRole: (role: UserRole) => useAuthStore((state) => state.user?.role === role),
};

// Initialize auth on app start
export const initializeAuth = () => {
  const store = useAuthStore.getState();
  if (store.token && !store.checkTokenValidity()) {
    store.logout();
  }
};