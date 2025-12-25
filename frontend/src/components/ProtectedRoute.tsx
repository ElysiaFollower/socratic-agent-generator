/**
 * Protected route component.
 *
 * This component protects routes that require authentication,
 * following Google TypeScript Style Guide.
 */

import React, {ReactNode} from 'react';
import {useAuth} from '../hooks';
import {UserRole} from '../types';
import {Login} from './Login';

/**
 * Props for ProtectedRoute component.
 */
interface ProtectedRouteProps {
  readonly children: ReactNode;
  readonly requiredRoles?: readonly UserRole[];
  readonly fallback?: ReactNode;
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
  const {children, requiredRoles, fallback} = props;
  const {isAuthenticated, isLoading, hasAnyRole} = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : <Login />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(requiredRoles)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              权限不足
            </h2>
            <p className="text-gray-600">
              您没有访问此页面的权限。请联系管理员。
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}


