/**
 * Health check API service.
 *
 * This module handles health check API calls.
 */

import {apiClient, handleApiError} from './client';
import {HealthCheckResponse} from '../types';

/**
 * Performs a health check on the API.
 *
 * @returns Promise resolving to health check response
 * @throws Error if the API request fails
 */
export async function healthCheck(): Promise<HealthCheckResponse> {
  try {
    const response = await apiClient.get<HealthCheckResponse>('/api/health');
    return response.data;
  } catch (error) {
    throw new Error(`Health check failed: ${handleApiError(error)}`);
  }
}




