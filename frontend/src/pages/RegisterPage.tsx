/**
 * Register page component.
 *
 * This component handles routing for the registration view.
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import {Navigate, useNavigate} from 'react-router-dom';
import {Register} from '../components';
import {useAuth} from '../hooks';

/**
 * Register page component.
 *
 * @returns React component
 */
export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const {isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary">加载中...</Typography>
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <Register
      onRegisterSuccess={() => navigate('/app')}
      onSwitchToLogin={() => navigate('/login')}
    />
  );
}
