/**
 * LLM settings API service.
 */

import { apiClient, handleApiError } from "./client";
import {
  LLMSettingsResponse,
  SaveLLMProviderRequest,
  SetDefaultLLMProviderRequest,
  TestLLMLatencyRequest,
  TestLLMLatencyResponse,
} from "../types";

export async function getLLMSettings(): Promise<LLMSettingsResponse> {
  try {
    const response = await apiClient.get<LLMSettingsResponse>("/api/settings/llm");
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch LLM settings: ${handleApiError(error)}`);
  }
}

export async function saveLLMProviderSettings(
  payload: SaveLLMProviderRequest,
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.post<{ success: boolean }>(
      "/api/settings/llm",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to save LLM settings: ${handleApiError(error)}`);
  }
}

export async function setDefaultLLMProvider(
  payload: SetDefaultLLMProviderRequest,
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.post<{ success: boolean }>(
      "/api/settings/llm/default",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to set default LLM provider: ${handleApiError(error)}`);
  }
}

export async function testLLMLatency(
  payload: TestLLMLatencyRequest,
): Promise<TestLLMLatencyResponse> {
  try {
    const response = await apiClient.post<TestLLMLatencyResponse>(
      "/api/settings/llm/test",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to test LLM latency: ${handleApiError(error)}`);
  }
}
