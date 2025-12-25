/**
 * Session API service.
 *
 * This module handles all API calls related to learning sessions.
 */

import {apiClient, handleApiError} from './client';
import {
  Session,
  SessionSummary,
  CreateSessionRequest,
  RenameSessionRequest,
} from '../types';

/**
 * Fetches all available sessions.
 *
 * @returns Promise resolving to array of session summaries
 * @throws Error if the API request fails
 */
export async function listSessions(): Promise<readonly SessionSummary[]> {
  try {
    const response = await apiClient.get<readonly SessionSummary[]>(
      '/api/sessions',
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch sessions: ${handleApiError(error)}`);
  }
}

/**
 * Fetches a specific session by ID.
 *
 * @param sessionId - The unique identifier of the session
 * @returns Promise resolving to the session
 * @throws Error if the session is not found or request fails
 */
export async function getSession(sessionId: string): Promise<Session> {
  try {
    const response = await apiClient.get<Session>(
      `/api/sessions/${sessionId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch session: ${handleApiError(error)}`);
  }
}

/**
 * Creates a new learning session.
 *
 * @param request - Session creation request payload
 * @returns Promise resolving to session ID
 * @throws Error if the API request fails
 */
export async function createSession(
  request: CreateSessionRequest,
): Promise<{session_id: string}> {
  try {
    const response = await apiClient.post<{session_id: string}>(
      '/api/sessions/create',
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to create session: ${handleApiError(error)}`);
  }
}

/**
 * Renames a session.
 *
 * @param sessionId - The unique identifier of the session
 * @param request - Rename request payload
 * @returns Promise resolving to success status
 * @throws Error if the API request fails
 */
export async function renameSession(
  sessionId: string,
  request: RenameSessionRequest,
): Promise<{success: boolean; message: string}> {
  try {
    const response = await apiClient.put<{success: boolean; message: string}>(
      `/api/sessions/${sessionId}/rename`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to rename session: ${handleApiError(error)}`);
  }
}

/**
 * Deletes a session.
 *
 * @param sessionId - The unique identifier of the session
 * @returns Promise resolving to success status
 * @throws Error if the API request fails
 */
export async function deleteSession(
  sessionId: string,
): Promise<{success: boolean; message: string}> {
  try {
    const response = await apiClient.delete<{success: boolean; message: string}>(
      `/api/sessions/${sessionId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to delete session: ${handleApiError(error)}`);
  }
}


