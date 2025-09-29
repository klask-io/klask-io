import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authSelectors } from '../../stores/auth-store';
import { FullPageSpinner } from '../ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = authSelectors.isAuthenticated();
  const isLoading = authSelectors.isLoading();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  return <>{children}</>;
};