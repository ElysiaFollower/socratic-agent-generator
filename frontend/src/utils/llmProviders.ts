/**
 * Supported LLM providers for UI selection.
 */

export interface LLMProviderOption {
  readonly value: string;
  readonly label: string;
  readonly defaultModel: string;
}

export const LLM_PROVIDERS: readonly LLMProviderOption[] = [
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "glm", label: "GLM", defaultModel: "glm-4.7" },
  { value: "minimax", label: "MiniMax", defaultModel: "abab6.5s-chat" },
];

export function getProviderOption(value: string): LLMProviderOption | undefined {
  return LLM_PROVIDERS.find((provider) => provider.value === value);
}
