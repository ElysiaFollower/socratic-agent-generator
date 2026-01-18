/**
 * Login page component.
 *
 * This component handles routing for the login view.
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import {Navigate, useNavigate} from 'react-router-dom';
import {Login} from '../components';
import {useAuth} from '../hooks';

/**
 * Login page component.
 *
 * @returns React component
 */
export function LoginPage(): JSX.Element {
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
    <Login
      onLoginSuccess={() => navigate('/app')}
      onSwitchToRegister={() => navigate('/register')}
    />
  );
}
