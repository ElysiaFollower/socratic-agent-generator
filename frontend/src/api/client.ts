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
import { SUPPORTED_LANGUAGES } from "../i18n";

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
 * Request interceptor to add authentication token and output language.
 * Excludes authentication endpoints (login, register) from token injection.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Don't add Authorization header for auth endpoints
    const isAuthEndpoint =
      config.url?.includes("/api/auth/login") ||
      config.url?.includes("/api/auth/register");

    if (!isAuthEndpoint) {
      const token = getAuthToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Add output_language parameter from current i18n language
    const currentLanguage = localStorage.getItem("i18nextLng") || "zh";
    const outputLanguage =
      SUPPORTED_LANGUAGES[currentLanguage as keyof typeof SUPPORTED_LANGUAGES]
        ?.llmLanguage || SUPPORTED_LANGUAGES.zh.llmLanguage;

    // Add to params (for GET requests) or data (for POST requests with JSON body)
    if (config.method === "get" || !config.data) {
      config.params = {
        ...config.params,
        output_language: outputLanguage,
      };
    } else if (typeof config.data === "object") {
      // For POST/PUT/etc with existing data, add to the data object
      (config.data as Record<string, unknown>).output_language = outputLanguage;
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
