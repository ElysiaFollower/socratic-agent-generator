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

/**
 * Request payload for renaming a profile.
 */
export interface RenameProfileRequest {
  readonly profile_name: string;
}

/**
 * Renames a profile by ID.
 *
 * @param profileId - The unique identifier of the profile
 * @param request - RenameProfileRequest containing new profile name
 * @returns Promise resolving to updated profile
 * @throws Error if the rename fails
 */
export async function renameProfile(
  profileId: string,
  request: RenameProfileRequest,
): Promise<Profile> {
  try {
    const response = await apiClient.put<Profile>(
      `/api/profiles/${profileId}/rename`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to rename profile: ${handleApiError(error)}`);
  }
}

/**
 * Deletes a profile by ID.
 *
 * @param profileId - The unique identifier of the profile
 * @returns Promise resolving when deletion succeeds
 * @throws Error if the deletion fails
 */
export async function deleteProfile(profileId: string): Promise<void> {
  try {
    await apiClient.delete(`/api/profiles/${profileId}`);
  } catch (error) {
    throw new Error(`Failed to delete profile: ${handleApiError(error)}`);
  }
}

/**
 * Request payload for uploading a lab manual.
 */
export interface UploadLabManualRequest {
  readonly file: File;
  readonly lab_name: string;
}

/**
 * Response from uploading a lab manual.
 */
export interface UploadLabManualResponse {
  readonly success: boolean;
  readonly message: string;
  readonly lab_name: string;
  readonly saved_path: string;
  readonly size: number;
}

/**
 * Uploads a lab manual file.
 *
 * @param request - UploadLabManualRequest containing file and lab_name
 * @returns Promise resolving to upload response
 * @throws Error if the upload fails
 */
export async function uploadLabManual(
  request: UploadLabManualRequest,
): Promise<UploadLabManualResponse> {
  try {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('lab_name', request.lab_name);

    const response = await apiClient.post<UploadLabManualResponse>(
      '/api/profiles/upload-lab-manual',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to upload lab manual: ${handleApiError(error)}`);
  }
}

/**
 * Request payload for generating a profile.
 */
export interface GenerateProfileRequest {
  readonly lab_manual_content: string;
  readonly profile_name?: string;
  readonly filename?: string;
}

/**
 * Generates a tutor profile from lab manual content.
 *
 * @param request - GenerateProfileRequest containing lab manual content and optional profile name
 * @returns Promise resolving to the generated profile
 * @throws Error if the generation fails
 */
export async function generateProfile(
  request: GenerateProfileRequest,
): Promise<Profile> {
  try {
    const response = await apiClient.post<Profile>(
      '/api/profiles/generate',
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to generate profile: ${handleApiError(error)}`);
  }
}

/**
 * Lab manual directory information.
 */
export interface LabManualInfo {
  readonly lab_name: string;
  readonly has_lab_manual: boolean;
  readonly has_persona: boolean;
  readonly has_curriculum: boolean;
}

/**
 * Lists all lab manuals in data_raw directory.
 *
 * @returns Promise resolving to array of lab manual info
 * @throws Error if the request fails
 */
export async function listLabManuals(): Promise<readonly LabManualInfo[]> {
  try {
    const response = await apiClient.get<readonly LabManualInfo[]>(
      '/api/profiles/lab-manuals',
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to list lab manuals: ${handleApiError(error)}`);
  }
}

/**
 * Lab manual content response.
 */
export interface LabManualContent {
  readonly lab_name: string;
  readonly content: string;
  readonly size: number;
}

/**
 * Gets the content of a lab manual file.
 *
 * @param labName - Name of the lab directory
 * @returns Promise resolving to lab manual content
 * @throws Error if the request fails
 */
export async function getLabManualContent(
  labName: string,
): Promise<LabManualContent> {
  try {
    const response = await apiClient.get<LabManualContent>(
      `/api/profiles/lab-manuals/${labName}/content`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to get lab manual content: ${handleApiError(error)}`,
    );
  }
}

/**
 * Deletes a lab manual directory and all its contents.
 *
 * @param labName - Name of the lab directory to delete
 * @returns Promise resolving to success response
 * @throws Error if the request fails
 */
export async function deleteLabManual(labName: string): Promise<void> {
  try {
    await apiClient.delete(`/api/profiles/lab-manuals/${labName}`);
  } catch (error) {
    throw new Error(`Failed to delete lab manual: ${handleApiError(error)}`);
  }
}

/**
 * TutorPersona type (imported from types if available, otherwise defined here).
 */
export interface TutorPersona {
  readonly topic_name: string;
  readonly persona_hints: readonly string[];
  readonly domain_specific_constraints: readonly string[];
  readonly target_audience: string;
}

/**
 * SocraticStep type.
 */
export interface SocraticStep {
  readonly step_title: string;
  readonly guiding_question: string;
  readonly success_criteria: string;
  readonly learning_objective: string;
}

/**
 * SocraticCurriculum type.
 */
export interface SocraticCurriculum {
  readonly root: readonly SocraticStep[];
}

/**
 * Gets persona for a lab manual.
 *
 * @param labName - Name of the lab directory
 * @returns Promise resolving to TutorPersona
 * @throws Error if the request fails
 */
export async function getPersona(labName: string): Promise<TutorPersona> {
  try {
    const response = await apiClient.get<TutorPersona>(
      `/api/profiles/lab-manuals/${labName}/persona`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get persona: ${handleApiError(error)}`);
  }
}

/**
 * Saves persona for a lab manual.
 *
 * @param labName - Name of the lab directory
 * @param persona - TutorPersona object to save
 * @returns Promise resolving to saved TutorPersona
 * @throws Error if the request fails
 */
export async function savePersona(
  labName: string,
  persona: TutorPersona,
): Promise<TutorPersona> {
  try {
    const response = await apiClient.post<TutorPersona>(
      `/api/profiles/lab-manuals/${labName}/persona`,
      persona,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to save persona: ${handleApiError(error)}`);
  }
}

/**
 * Gets curriculum for a lab manual.
 *
 * @param labName - Name of the lab directory
 * @returns Promise resolving to SocraticCurriculum
 * @throws Error if the request fails
 */
export async function getCurriculum(
  labName: string,
): Promise<SocraticCurriculum> {
  try {
    const response = await apiClient.get<SocraticCurriculum>(
      `/api/profiles/lab-manuals/${labName}/curriculum`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get curriculum: ${handleApiError(error)}`);
  }
}

/**
 * Saves curriculum for a lab manual.
 *
 * @param labName - Name of the lab directory
 * @param curriculum - SocraticCurriculum object to save
 * @returns Promise resolving to saved SocraticCurriculum
 * @throws Error if the request fails
 */
export async function saveCurriculum(
  labName: string,
  curriculum: SocraticCurriculum,
): Promise<SocraticCurriculum> {
  try {
    const response = await apiClient.post<SocraticCurriculum>(
      `/api/profiles/lab-manuals/${labName}/curriculum`,
      curriculum,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to save curriculum: ${handleApiError(error)}`);
  }
}

/**
 * Generates persona for a lab manual.
 *
 * @param labName - Name of the lab directory
 * @returns Promise resolving to generated TutorPersona
 * @throws Error if the generation fails
 */
export async function generatePersona(labName: string): Promise<TutorPersona> {
  try {
    const response = await apiClient.post<TutorPersona>(
      `/api/profiles/lab-manuals/${labName}/generate-persona`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to generate persona: ${handleApiError(error)}`);
  }
}

/**
 * Generates curriculum for a lab manual.
 *
 * @param labName - Name of the lab directory
 * @returns Promise resolving to generated SocraticCurriculum
 * @throws Error if the generation fails
 */
export async function generateCurriculum(
  labName: string,
): Promise<SocraticCurriculum> {
  try {
    const response = await apiClient.post<SocraticCurriculum>(
      `/api/profiles/lab-manuals/${labName}/generate-curriculum`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to generate curriculum: ${handleApiError(error)}`);
  }
}

/**
 * Generates profile from a lab manual using existing persona and curriculum.
 *
 * @param labName - Name of the lab directory
 * @param profileName - Optional profile name
 * @returns Promise resolving to generated Profile
 * @throws Error if the generation fails
 */
export async function generateProfileFromLab(
  labName: string,
  profileName?: string,
): Promise<Profile> {
  try {
    const response = await apiClient.post<Profile>(
      `/api/profiles/lab-manuals/${labName}/generate-profile`,
      {profile_name: profileName || undefined},
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to generate profile from lab: ${handleApiError(error)}`,
    );
  }
}
