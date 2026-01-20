/**
 * Permission guard component.
 *
 * This component conditionally renders children based on user permissions,
 * following Google TypeScript Style Guide.
 */

import React, { ReactNode } from "react";
import { useAuth } from "../../hooks";
import { UserRole } from "../../types";

/**
 * Props for PermissionGuard component.
 */
interface PermissionGuardProps {
  readonly children: ReactNode;
  readonly requiredRoles?: readonly UserRole[];
  readonly fallback?: ReactNode;
}

/**
 * Permission guard component.
 *
 * Renders children only if user has required roles.
 * Otherwise, renders fallback or nothing.
 *
 * @param props - Component props
 * @returns React component
 */
export function PermissionGuard(props: PermissionGuardProps): JSX.Element {
  const { requiredRoles, children, fallback } = props;
  const { hasAnyRole, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : <></>;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(requiredRoles)) {
      return fallback ? <>{fallback}</> : <></>;
    }
  }

  return <>{children}</>;
}
