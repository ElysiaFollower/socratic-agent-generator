/**
 * Authentication context and provider.
 *
 * This module provides authentication state management using React Context,
 * following Google TypeScript Style Guide.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {User, UserRole, LoginRequest} from '../types';
import {login as apiLogin, logout as apiLogout, getCurrentUser} from '../api';

/**
 * Authentication context value.
 */
interface AuthContextValue {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly login: (credentials: LoginRequest) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly refreshUser: () => Promise<void>;
  readonly hasRole: (role: UserRole) => boolean;
  readonly hasAnyRole: (roles: readonly UserRole[]) => boolean;
}

/**
 * Authentication context.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props for AuthProvider component.
 */
interface AuthProviderProps {
  readonly children: ReactNode;
}

/**
 * Authentication provider component.
 *
 * Manages authentication state and provides authentication methods to
 * child components.
 *
 * @param props - Component props
 * @returns React component
 */
export function AuthProvider(props: AuthProviderProps): JSX.Element {
  const {children} = props;
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Refreshes the current user information from the API.
   */
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      // Only log error if there's actually a token (user might not be logged in)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('未找到认证令牌')) {
        console.error('Failed to refresh user:', error);
      }
    }
  }, []);

  /**
   * Initializes authentication state on mount.
   */
  useEffect(() => {
    void (async () => {
      try {
        await refreshUser();
      } catch {
        // User is not authenticated, which is fine
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshUser]);

  /**
   * Logs in a user with credentials.
   *
   * @param credentials - Login credentials
   */
  const handleLogin = useCallback(
    async (credentials: LoginRequest) => {
      try {
        const response = await apiLogin(credentials);
        setUser(response.user);
      } catch (error) {
        throw error;
      }
    },
    [],
  );

  /**
   * Logs out the current user.
   */
  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  /**
   * Checks if the user has a specific role.
   *
   * @param role - The role to check
   * @returns True if user has the role, false otherwise
   */
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      return user?.role === role;
    },
    [user],
  );

  /**
   * Checks if the user has any of the specified roles.
   *
   * @param roles - Array of roles to check
   * @returns True if user has any of the roles, false otherwise
   */
  const hasAnyRole = useCallback(
    (roles: readonly UserRole[]): boolean => {
      if (!user) {
        return false;
      }
      return roles.includes(user.role);
    },
    [user],
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login: handleLogin,
    logout: handleLogout,
    refreshUser,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context.
 *
 * @returns Authentication context value
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


