/**
 * Profile API service.
 *
 * This module handles all API calls related to tutor profiles.
 */

import {apiClient, handleApiError} from './client';
import {Profile} from '../types';

/**
 * Fetches all available tutor profiles.
 *
 * @returns Promise resolving to array of profiles
 * @throws Error if the API request fails
 */
export async function listProfiles(): Promise<readonly Profile[]> {
  try {
    const response = await apiClient.get<readonly Profile[]>('/api/profiles');
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch profiles: ${handleApiError(error)}`);
  }
}

/**
 * Fetches a specific profile by ID.
 *
 * @param profileId - The unique identifier of the profile
 * @returns Promise resolving to the profile
 * @throws Error if the profile is not found or request fails
 */
export async function getProfile(profileId: string): Promise<Profile> {
  try {
    const response = await apiClient.get<Profile>(`/api/profiles/${profileId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch profile: ${handleApiError(error)}`);
  }
}


