/**
 * Protected route component.
 *
 * This component protects routes that require authentication,
 * following Google TypeScript Style Guide.
 */

import React, { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks";
import { UserRole } from "../../types";
import { Login } from "./Login";

/**
 * Props for ProtectedRoute component.
 */
interface ProtectedRouteProps {
  readonly children: ReactNode;
  readonly requiredRoles?: readonly UserRole[];
  readonly fallback?: ReactNode;
  readonly redirectTo?: string;
}

/**
 * Protected route wrapper component.
 *
 * Renders children only if user is authenticated and has required roles.
 * Otherwise, renders login form or fallback.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProtectedRoute(props: ProtectedRouteProps): JSX.Element {
  const { children, requiredRoles, fallback, redirectTo } = props;
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color='text.secondary'>加载中...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <Login />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(requiredRoles)) {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box textAlign='center'>
            <Typography variant='h5' sx={{ fontWeight: 700, mb: 1 }}>
              权限不足
            </Typography>
            <Typography color='text.secondary'>
              您没有访问此页面的权限。请联系管理员。
            </Typography>
          </Box>
        </Box>
      );
    }
  }

  return <>{children}</>;
}
