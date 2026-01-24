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
  readonly owner_id?: string;
  readonly visible_class_ids?: readonly string[];
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
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly isThinking?: boolean;
  readonly thinkingMessage?: string;
  readonly messageId?: number;
}

/**
 * Represents a message in session history.
 * Backend returns messages with type "human" (user) or "ai" (assistant).
 */
export interface SessionHistoryMessage {
  readonly type: "human" | "ai";
  readonly content: string;
  readonly timestamp?: string;
  readonly message_id?: number;
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
  readonly provider?: string;
  readonly model?: string;
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
  readonly message_id?: number;
  readonly step_completion?: StepCompletion;
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
 * Represents a step completion mapping.
 */
export interface StepCompletion {
  readonly step_index: number;
  readonly message_id: number;
}

/**
 * Welcome message response.
 */
export interface WelcomeMessageResponse {
  readonly welcome: string;
}

/**
 * LLM provider status for settings UI.
 */
export interface LLMProviderStatus {
  readonly provider: string;
  readonly has_api_key: boolean;
  readonly model?: string | null;
  readonly source?: "user" | "preset" | "none";
}

/**
 * LLM settings response.
 */
export interface LLMSettingsResponse {
  readonly providers: readonly LLMProviderStatus[];
  readonly default_provider: string;
  readonly default_model?: string | null;
}

export interface SaveLLMProviderRequest {
  readonly provider: string;
  readonly api_key: string;
  readonly model?: string;
}

export interface SetDefaultLLMProviderRequest {
  readonly provider: string;
  readonly model?: string;
}

export interface TestLLMLatencyRequest {
  readonly provider: string;
  readonly api_key: string;
  readonly model?: string;
}

export interface TestLLMLatencyResponse {
  readonly ok: boolean;
  readonly latency_ms?: number;
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
export type UserRole = "admin" | "teacher" | "student";

/**
 * Main workspace panel views.
 */
export type ToolPanelView =
  | "chat"
  | "invitation"
  | "lab-manual"
  | "skill"
  | "profile"
  | "class";

/**
 * Represents a class managed by teachers and joined by students.
 */
export interface ClassInfo {
  readonly class_id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly role_in_class?: "teacher" | "student";
}

/**
 * Represents a class member summary.
 */
export interface ClassMemberInfo {
  readonly user_id: string;
  readonly username: string;
  readonly display_name?: string;
  readonly role_in_class: "teacher" | "student";
  readonly joined_at: string;
}

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
 * Generate class invitation code request.
 */
export interface GenerateInvitationCodeRequest {
  readonly class_id: string;
  readonly expires_in_days?: number;
}

/**
 * Generate class invitation code response.
 */
export interface GenerateInvitationCodeResponse {
  readonly invitation_code: string;
  readonly class_id: string;
  readonly created_by: string;
  readonly created_at?: string;
  readonly expires_at: string;
}

/**
 * Class invitation code info.
 */
export interface InvitationCodeInfo {
  readonly invitation_code: string;
  readonly class_id: string;
  readonly created_by: string;
  readonly created_at: string;
  readonly expires_at?: string | null;
}

/**
 * Class invitation code list response.
 */
export interface InvitationCodeListResponse {
  readonly invitation_codes: readonly InvitationCodeInfo[];
}

/**
 * Generate registration invitation code request.
 */
export interface GenerateRegistrationInvitationCodeRequest {
  readonly role: "teacher" | "student";
  readonly expires_in_days?: number;
}

/**
 * Registration invitation code info.
 */
export interface RegistrationInvitationCodeInfo {
  readonly invitation_code: string;
  readonly role: "teacher" | "student";
  readonly created_by: string;
  readonly created_at: string;
  readonly expires_at?: string | null;
}

/**
 * Registration invitation code list response.
 */
export interface RegistrationInvitationCodeListResponse {
  readonly invitation_codes: readonly RegistrationInvitationCodeInfo[];
}

/**
 * Create class request payload.
 */
export interface CreateClassRequest {
  readonly name: string;
}

/**
 * Join class request payload.
 */
export interface JoinClassRequest {
  readonly invitation_code: string;
}

/**
 * Update profile visibility payload.
 */
export interface UpdateProfileVisibilityRequest {
  readonly visible: boolean;
}
