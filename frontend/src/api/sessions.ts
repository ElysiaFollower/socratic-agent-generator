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
  RemoteCommandAudit,
  SessionFileInfo,
  SessionRemoteCommandRequest,
  SessionRemoteCommandResponse,
  StepCompletion,
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

/**
 * Fetches step completion records for a session.
 *
 * @param sessionId - The unique identifier of the session
 * @returns Promise resolving to step completion list
 * @throws Error if the API request fails
 */
export async function getSessionStepCompletions(
  sessionId: string,
): Promise<readonly StepCompletion[]> {
  try {
    const response = await apiClient.get<readonly StepCompletion[]>(
      `/api/sessions/${sessionId}/step-completions`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch step completions: ${handleApiError(error)}`,
    );
  }
}

export async function getSessionRemoteAudits(
  sessionId: string,
): Promise<readonly RemoteCommandAudit[]> {
  try {
    const response = await apiClient.get<readonly RemoteCommandAudit[]>(
      `/api/sessions/${sessionId}/remote-audits`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch remote audits: ${handleApiError(error)}`,
    );
  }
}

export async function listSessionFiles(
  sessionId: string,
): Promise<readonly SessionFileInfo[]> {
  try {
    const response = await apiClient.get<readonly SessionFileInfo[]>(
      `/api/sessions/${sessionId}/files`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch session files: ${handleApiError(error)}`);
  }
}

export async function uploadSessionFile(
  sessionId: string,
  file: File,
): Promise<SessionFileInfo> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<SessionFileInfo>(
      `/api/sessions/${sessionId}/files`,
      formData,
      {headers: {'Content-Type': 'multipart/form-data'}},
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to upload session file: ${handleApiError(error)}`);
  }
}

export async function putSessionFileToRemote(
  sessionId: string,
  filename: string,
  remotePath: string,
): Promise<{ok: boolean; local_filename: string; remote_path: string}> {
  try {
    const response = await apiClient.post<{
      ok: boolean;
      local_filename: string;
      remote_path: string;
    }>(
      `/api/sessions/${sessionId}/files/${encodeURIComponent(filename)}/remote-put`,
      {remote_path: remotePath},
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to put session file: ${handleApiError(error)}`);
  }
}

export async function runSessionRemoteCommand(
  sessionId: string,
  request: SessionRemoteCommandRequest,
): Promise<SessionRemoteCommandResponse> {
  try {
    const response = await apiClient.post<SessionRemoteCommandResponse>(
      `/api/sessions/${sessionId}/remote-command`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to run remote command: ${handleApiError(error)}`);
  }
}

