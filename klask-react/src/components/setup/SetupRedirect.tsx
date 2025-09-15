import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const SetupRedirect: React.FC = () => {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${API_BASE_URL}/api/auth/setup/check`);
        const data = await response.json();
        
        setNeedsSetup(data.needs_setup);
      } catch (error) {
        console.error('Failed to check setup status:', error);
        // En cas d'erreur, on assume qu'il faut aller vers le login
        setNeedsSetup(false);
      }
    };

    checkSetup();
  }, []);

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Si il faut faire le setup, rediriger vers /setup
  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  // Sinon, rediriger vers /search (on est déjà dans le contexte protégé)
  return <Navigate to="/search" replace />;
};

export default SetupRedirect;