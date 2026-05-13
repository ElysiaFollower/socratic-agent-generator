/**
 * LLM settings API service.
 */

import { apiClient, handleApiError } from "./client";
import {
  LLMSettingsResponse,
  RemoteMachineSummary,
  RemoteMachineTestResponse,
  SaveLLMProviderRequest,
  SaveRemoteMachineRequest,
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

export async function listRemoteMachines(): Promise<readonly RemoteMachineSummary[]> {
  try {
    const response = await apiClient.get<readonly RemoteMachineSummary[]>(
      "/api/settings/remote-machines",
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch remote machines: ${handleApiError(error)}`);
  }
}

export async function createRemoteMachine(
  payload: SaveRemoteMachineRequest,
): Promise<RemoteMachineSummary> {
  try {
    const response = await apiClient.post<RemoteMachineSummary>(
      "/api/settings/remote-machines",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to save remote machine: ${handleApiError(error)}`);
  }
}

export async function updateRemoteMachine(
  machineId: string,
  payload: SaveRemoteMachineRequest,
): Promise<RemoteMachineSummary> {
  try {
    const response = await apiClient.put<RemoteMachineSummary>(
      `/api/settings/remote-machines/${machineId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update remote machine: ${handleApiError(error)}`);
  }
}

export async function deleteRemoteMachine(
  machineId: string,
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/settings/remote-machines/${machineId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to delete remote machine: ${handleApiError(error)}`);
  }
}

export async function testRemoteMachine(
  machineId: string,
): Promise<RemoteMachineTestResponse> {
  try {
    const response = await apiClient.post<RemoteMachineTestResponse>(
      `/api/settings/remote-machines/${machineId}/test`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to test remote machine: ${handleApiError(error)}`);
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

export async function deleteLLMProviderSettings(
  provider: string,
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/settings/llm/${provider}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to delete LLM settings: ${handleApiError(error)}`,
    );
  }
}
