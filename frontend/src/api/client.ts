/**
 * HTTP client configuration and utilities.
 *
 * This module provides a configured axios instance and HTTP client utilities.
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { getAuthToken } from "./auth";

/**
 * Base API URL - defaults to empty string for relative URLs.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Configured axios instance for API requests.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 600000, // 600 seconds (10 minutes)
});

/**
 * Request interceptor to add authentication token.
 * Excludes authentication endpoints (login, register) from token injection.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Don't add Authorization header for auth endpoints
    const isAuthEndpoint = 
      config.url?.includes('/api/auth/login') || 
      config.url?.includes('/api/auth/register');
    
    if (!isAuthEndpoint) {
      const token = getAuthToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Handles API errors and extracts error messages.
 *
 * @param error - The error object from axios
 * @returns Error message string
 */
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "未知错误";
}
