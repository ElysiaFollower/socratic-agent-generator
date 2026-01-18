/**
 * Type definitions for the Socratic Agent Generator frontend.
 *
 * This module contains all TypeScript type definitions used throughout
 * the application, following Google TypeScript Style Guide.
 */

/**
 * Represents a single step in the Socratic learning curriculum.
 */
export interface SocraticStep {
  readonly step_title: string;
  readonly guiding_question: string;
  readonly success_criteria: string;
  readonly learning_objective: string;
}

/**
 * Curriculum structure with root steps.
 */
export interface SocraticCurriculum {
  readonly root: readonly SocraticStep[];
}

/**
 * Curriculum data can be either a direct array or an object with root field.
 */
export type CurriculumData = readonly SocraticStep[] | SocraticCurriculum;

/**
 * Represents a tutor profile configuration.
 */
export interface Profile {
  readonly profile_id: string;
  readonly profile_name?: string; // Optional, defaults to topic_name if empty
  readonly topic_name: string;
  readonly lab_name?: string;
  readonly persona_hints: readonly string[];
  readonly target_audience: string;
  readonly curriculum: CurriculumData;
  readonly prompt_template: string;
  readonly create_at: string;
  readonly update_at?: string;
}

/**
 * Represents a chat message in the conversation history.
 */
export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly isThinking?: boolean;
  readonly thinkingMessage?: string;
}

/**
 * Represents a message in session history.
 * Backend returns messages with type "human" (user) or "ai" (assistant).
 */
export interface SessionHistoryMessage {
  readonly type: 'human' | 'ai';
  readonly content: string;
  readonly timestamp?: string;
}

/**
 * Represents a learning session.
 */
export interface Session {
  readonly session_id: string;
  readonly session_name: string;
  readonly profile: Profile;
  readonly state: {
    readonly stepIndex: number;
  };
  readonly create_at: string;
  readonly update_at: string;
  readonly output_language: string;
  readonly history: readonly SessionHistoryMessage[];
}

/**
 * Summary information for a session (used in lists).
 */
export interface SessionSummary {
  readonly session_id: string;
  readonly session_name: string;
  readonly profile_id: string;
  readonly profile_name: string;
  readonly topic_name: string;
  readonly create_at: string;
  readonly update_at: string;
}

/**
 * Request payload for creating a new session.
 */
export interface CreateSessionRequest {
  readonly profile_id: string;
  readonly session_name?: string; // Optional, defaults to "新会话"
  readonly output_language?: string; // Optional, defaults to "Simplified Chinese"
}

/**
 * Request payload for sending a message.
 */
export interface MessageRequest {
  readonly message: string;
}

/**
 * Request payload for renaming a session.
 */
export interface RenameSessionRequest {
  readonly session_name: string;
}

/**
 * Response from sending a message.
 */
export interface SendMessageResponse {
  readonly reply: string;
  readonly state: {
    readonly stepIndex: number;
  };
  readonly is_finished: boolean;
}

/**
 * Current state of a learning session.
 */
export interface SessionState {
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly isFinished: boolean;
}

/**
 * Welcome message response.
 */
export interface WelcomeMessageResponse {
  readonly welcome: string;
}

/**
 * Health check response.
 */
export interface HealthCheckResponse {
  readonly status: string;
}

/**
 * User role types.
 */
export type UserRole = 'admin' | 'teacher' | 'student';

/**
 * Represents a user in the system.
 */
export interface User {
  readonly user_id: string;
  readonly username: string;
  readonly role: UserRole;
  readonly display_name?: string;
  readonly email?: string;
}

/**
 * Login request payload.
 */
export interface LoginRequest {
  readonly username: string;
  readonly password: string;
}

/**
 * Login response.
 */
export interface LoginResponse {
  readonly user: User;
  readonly token: string;
}

/**
 * Current user response.
 */
export interface CurrentUserResponse {
  readonly user: User;
}

/**
 * Register request payload.
 */
export interface RegisterRequest {
  readonly username: string;
  readonly password: string;
  readonly role: UserRole;
  readonly display_name?: string;
  readonly email?: string;
  readonly admin_token?: string;
  readonly invitation_code?: string;
}

/**
 * Register response.
 */
export interface RegisterResponse {
  readonly success: boolean;
  readonly message: string;
  readonly user_id: string;
}

/**
 * Generate invitation code request.
 */
export interface GenerateInvitationCodeRequest {
  readonly role: 'teacher' | 'student';
  readonly expires_in_days?: number;
}

/**
 * Generate invitation code response.
 */
export interface GenerateInvitationCodeResponse {
  readonly invitation_code: string;
  readonly role: 'teacher' | 'student';
  readonly created_by: string;
  readonly expires_in_days: number;
  readonly expires_at: string;
}
