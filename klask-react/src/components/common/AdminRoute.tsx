import React from 'react';
import { Navigate } from 'react-router-dom';
import { authSelectors } from '../../stores/auth-store';
import { UserRole } from '../../types';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const user = authSelectors.user();
  const isAuthenticated = authSelectors.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-8">
            You don't have permission to access this page.
          </p>
          <a href="/search" className="btn-primary">
            Go to Search
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};