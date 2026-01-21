/**
 * Authentication API service.
 *
 * This module handles all API calls related to user authentication and
 * authorization, following Google TypeScript Style Guide.
 */

import {apiClient, handleApiError} from './client';
import {
  LoginRequest,
  LoginResponse,
  CurrentUserResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  GenerateRegistrationInvitationCodeRequest,
  RegistrationInvitationCodeInfo,
  RegistrationInvitationCodeListResponse,
} from '../types';

/**
 * Storage key for authentication token.
 */
const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';

/**
 * Gets the stored authentication token.
 *
 * @returns The authentication token or null if not found
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Sets the authentication token in storage.
 *
 * @param token - The authentication token to store
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Removes the authentication token from storage.
 */
export function removeAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Gets the stored user information.
 *
 * @returns The user object or null if not found
 */
export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) {
    return null;
  }
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

/**
 * Sets the user information in storage.
 *
 * @param user - The user object to store
 */
export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Removes the user information from storage.
 */
export function removeStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

/**
 * Logs in a user with username and password.
 *
 * @param credentials - Login credentials
 * @returns Promise resolving to login response with user and token
 * @throws Error if login fails
 */
export async function login(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>(
      '/api/auth/login',
      credentials,
    );
    const {user, token} = response.data;
    setAuthToken(token);
    setStoredUser(user);
    return response.data;
  } catch (error) {
    throw new Error(`登录失败: ${handleApiError(error)}`);
  }
}

/**
 * Logs out the current user.
 *
 * @returns Promise resolving when logout is complete
 * @throws Error if logout fails
 */
export async function logout(): Promise<void> {
  try {
    const token = getAuthToken();
    if (token) {
      await apiClient.post('/api/auth/logout', undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    // Continue with local cleanup even if API call fails
    console.error('Logout API call failed:', error);
  } finally {
    removeAuthToken();
    removeStoredUser();
  }
}

/**
 * Gets the current authenticated user.
 *
 * @returns Promise resolving to the current user
 * @throws Error if user is not authenticated or request fails
 */
export async function getCurrentUser(): Promise<User> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未找到认证令牌');
  }
  
  try {
    const response = await apiClient.get<CurrentUserResponse>(
      '/api/auth/me',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const {user} = response.data;
    setStoredUser(user);
    return user;
  } catch (error) {
    // Clear invalid token
    removeAuthToken();
    removeStoredUser();
    throw new Error(`获取用户信息失败: ${handleApiError(error)}`);
  }
}

/**
 * Checks if the user is authenticated.
 *
 * @returns True if a valid token exists, false otherwise
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Registers a new user.
 *
 * @param request - Registration request with user details
 * @returns Promise resolving to register response
 * @throws Error if registration fails
 */
export async function register(
  request: RegisterRequest,
): Promise<RegisterResponse> {
  try {
    const response = await apiClient.post<RegisterResponse>(
      '/api/auth/register',
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`注册失败: ${handleApiError(error)}`);
  }
}

/**
 * Generates a registration invitation code.
 *
 * @param request - Request with role and expiration days
 * @returns Promise resolving to invitation code info
 * @throws Error if generation fails
 */
export async function generateRegistrationInvitationCode(
  request: GenerateRegistrationInvitationCodeRequest,
): Promise<RegistrationInvitationCodeInfo> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未找到认证令牌');
  }
  try {
    const response = await apiClient.post<RegistrationInvitationCodeInfo>(
      '/api/auth/invitation-codes/generate',
      request,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`生成邀请码失败: ${handleApiError(error)}`);
  }
}

/**
 * Lists registration invitation codes.
 *
 * @param role - Optional role filter ('teacher' or 'student')
 * @returns Promise resolving to invitation code list
 * @throws Error if listing fails
 */
export async function listRegistrationInvitationCodes(
  role?: string,
): Promise<RegistrationInvitationCodeListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未找到认证令牌');
  }
  try {
    const params = role ? { role } : {};
    const response = await apiClient.get<RegistrationInvitationCodeListResponse>(
      '/api/auth/invitation-codes',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`加载邀请码失败: ${handleApiError(error)}`);
  }
}

/**
 * Deletes a registration invitation code.
 *
 * @param code - Invitation code to delete
 * @returns Promise resolving when deletion is complete
 * @throws Error if deletion fails
 */
export async function deleteRegistrationInvitationCode(
  code: string,
): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未找到认证令牌');
  }
  try {
    await apiClient.delete(`/api/auth/invitation-codes/${code}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw new Error(`删除邀请码失败: ${handleApiError(error)}`);
  }
}

/**
 * Updates a registration invitation code expiration date.
 *
 * @param code - Invitation code to update
 * @param expiresInDays - Number of days until expiration
 * @returns Promise resolving to updated invitation code info
 * @throws Error if update fails
 */
export async function updateRegistrationInvitationCode(
  code: string,
  expiresInDays: number,
): Promise<RegistrationInvitationCodeInfo> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未找到认证令牌');
  }
  try {
    const response = await apiClient.patch<RegistrationInvitationCodeInfo>(
      `/api/auth/invitation-codes/${code}`,
      { expires_in_days: expiresInDays },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`更新邀请码失败: ${handleApiError(error)}`);
  }
}

/**
 * Gets user information by user ID.
 *
 * @param userId - The user ID to look up
 * @returns Promise resolving to user information
 * @throws Error if fetch fails
 */
export async function getUserById(
  userId: string,
): Promise<User> {
  try {
    const response = await apiClient.get<User>(
      `/api/auth/users/${userId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`获取用户信息失败: ${handleApiError(error)}`);
  }
}
