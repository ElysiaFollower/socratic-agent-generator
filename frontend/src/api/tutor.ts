/**
 * Tutor interaction API service.
 *
 * This module handles all API calls related to tutor interactions,
 * including message streaming and session state.
 */

import {apiClient, handleApiError} from './client';
import {
  SessionState,
  WelcomeMessageResponse,
  SendMessageResponse,
  MessageRequest,
} from '../types';

/**
 * Fetches the welcome message for a session.
 *
 * @param sessionId - The unique identifier of the session
 * @returns Promise resolving to welcome message
 * @throws Error if the API request fails
 */
export async function getWelcomeMessage(
  sessionId: string,
): Promise<WelcomeMessageResponse> {
  try {
    const response = await apiClient.get<WelcomeMessageResponse>(
      `/api/tutor/${sessionId}/welcome`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch welcome message: ${handleApiError(error)}`);
  }
}

/**
 * Fetches the current state of a session.
 *
 * @param sessionId - The unique identifier of the session
 * @returns Promise resolving to session state
 * @throws Error if the API request fails
 */
export async function getSessionState(
  sessionId: string,
): Promise<SessionState> {
  try {
    const response = await apiClient.get<SessionState>(
      `/api/tutor/${sessionId}/state`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch session state: ${handleApiError(error)}`);
  }
}

/**
 * Callback function for handling stream tokens.
 */
export type StreamTokenCallback = (token: string) => void;

/**
 * Callback function for handling stream completion.
 */
export type StreamCompleteCallback = (response: SendMessageResponse) => void;

/**
 * Callback function for handling stream errors.
 */
export type StreamErrorCallback = (error: string) => void;

/**
 * Sends a message and streams the response.
 *
 * @param sessionId - The unique identifier of the session
 * @param message - The user message to send
 * @param onToken - Callback invoked for each token received
 * @param onComplete - Callback invoked when stream completes
 * @param onError - Callback invoked on error
 * @returns Promise that resolves when the stream completes
 */
export async function sendMessageStream(
  sessionId: string,
  message: string,
  onToken: StreamTokenCallback,
  onComplete: StreamCompleteCallback,
  onError: StreamErrorCallback,
): Promise<void> {
  try {
    // Encode message to Base64
    const encodedMessage = btoa(
      unescape(encodeURIComponent(message)),
    );

    const response = await fetch(
      `/api/sessions/${sessionId}/messages/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({message: encodedMessage}),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'token') {
              onToken(parsed.data);
            } else if (parsed.type === 'END') {
              onComplete(parsed.data);
            } else if (parsed.type === 'error') {
              onError(parsed.data);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
            onError('Failed to parse server response');
          }
        }
      }
    }
  } catch (error) {
    onError(
      error instanceof Error ? error.message : 'Unknown error occurred',
    );
  }
}


