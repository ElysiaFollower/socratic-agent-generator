/**
 * Custom skill API service.
 *
 * Handles API calls for custom skill materials and skills.
 */

import { apiClient, handleApiError } from "./client";

export interface SkillMaterialInfo {
  readonly id: number;
  readonly profile_id: string;
  readonly owner_id?: string | null;
  readonly filename?: string | null;
  readonly mime_type?: string | null;
  readonly size?: number | null;
  readonly content_hash?: string | null;
  readonly meta_info: Record<string, unknown>;
  readonly upload_time?: string | null;
}

export interface SkillMaterialDetail extends SkillMaterialInfo {
  readonly content: string;
}

export interface CustomSkillInfo {
  readonly id: number;
  readonly profile_id: string;
  readonly owner_id?: string | null;
  readonly skill_key?: string | null;
  readonly name: string;
  readonly description: string;
  readonly skill_type?: string | null;
  readonly tool_name: string;
  readonly index_path?: string | null;
  readonly status: string;
  readonly meta_info: Record<string, unknown>;
  readonly create_at?: string | null;
  readonly update_at?: string | null;
  readonly material_ids: readonly number[];
}

export interface CustomSkillDetail extends CustomSkillInfo {
  readonly instructions?: string | null;
}

export interface CustomSkillDraft {
  readonly skill_key?: string | null;
  readonly name: string;
  readonly description: string;
  readonly skill_type?: string | null;
  readonly tool_name: string;
  readonly instructions?: string | null;
  readonly index_path?: string | null;
  readonly status?: string | null;
  readonly meta_info: Record<string, unknown>;
}

export interface CustomSkillGenerateRequest {
  readonly material_ids: readonly number[];
  readonly hint?: string;
}

export interface CustomSkillGenerateResponse {
  readonly draft: CustomSkillDraft;
  readonly material_ids: readonly number[];
}

export interface CustomSkillCreateRequest {
  readonly skill_key?: string;
  readonly name: string;
  readonly description: string;
  readonly skill_type?: string;
  readonly tool_name: string;
  readonly instructions?: string;
  readonly index_path?: string;
  readonly status?: string;
  readonly meta_info?: Record<string, unknown>;
  readonly material_ids?: readonly number[];
}

export interface CustomSkillUpdateRequest {
  readonly skill_key?: string;
  readonly name?: string;
  readonly description?: string;
  readonly skill_type?: string;
  readonly tool_name?: string;
  readonly instructions?: string;
  readonly index_path?: string;
  readonly status?: string;
  readonly meta_info?: Record<string, unknown>;
  readonly material_ids?: readonly number[];
}

export interface CustomSkillAssignRequest {
  readonly profile_id: string;
  readonly material_ids?: readonly number[];
}

export async function uploadSkillMaterial(
  profileId: string,
  file: File,
  hint?: string,
): Promise<SkillMaterialInfo> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (hint) {
      formData.append("hint", hint);
    }
    const response = await apiClient.post<SkillMaterialInfo>(
      `/api/profiles/${profileId}/skill-materials`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to upload skill material: ${handleApiError(error)}`,
    );
  }
}

export async function listSkillMaterials(
  profileId: string,
): Promise<readonly SkillMaterialInfo[]> {
  try {
    const response = await apiClient.get<readonly SkillMaterialInfo[]>(
      `/api/profiles/${profileId}/skill-materials`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to list skill materials: ${handleApiError(error)}`);
  }
}

export async function getSkillMaterial(
  profileId: string,
  materialId: number,
): Promise<SkillMaterialDetail> {
  try {
    const response = await apiClient.get<SkillMaterialDetail>(
      `/api/profiles/${profileId}/skill-materials/${materialId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get skill material: ${handleApiError(error)}`);
  }
}

export async function deleteSkillMaterial(
  profileId: string,
  materialId: number,
): Promise<void> {
  try {
    await apiClient.delete(
      `/api/profiles/${profileId}/skill-materials/${materialId}`,
    );
  } catch (error) {
    throw new Error(
      `Failed to delete skill material: ${handleApiError(error)}`,
    );
  }
}

export async function generateCustomSkillDraft(
  profileId: string,
  request: CustomSkillGenerateRequest,
): Promise<CustomSkillGenerateResponse> {
  try {
    const response = await apiClient.post<CustomSkillGenerateResponse>(
      `/api/profiles/${profileId}/skills/generate`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to generate skill draft: ${handleApiError(error)}`);
  }
}

export async function createCustomSkill(
  profileId: string,
  request: CustomSkillCreateRequest,
): Promise<CustomSkillDetail> {
  try {
    const response = await apiClient.post<CustomSkillDetail>(
      `/api/profiles/${profileId}/skills`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to create skill: ${handleApiError(error)}`);
  }
}

export async function listCustomSkills(
  profileId: string,
): Promise<readonly CustomSkillInfo[]> {
  try {
    const response = await apiClient.get<readonly CustomSkillInfo[]>(
      `/api/profiles/${profileId}/skills`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to list custom skills: ${handleApiError(error)}`);
  }
}

export async function getCustomSkill(
  skillId: number,
): Promise<CustomSkillDetail> {
  try {
    const response = await apiClient.get<CustomSkillDetail>(
      `/api/skills/${skillId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get custom skill: ${handleApiError(error)}`);
  }
}

export async function updateCustomSkill(
  skillId: number,
  request: CustomSkillUpdateRequest,
): Promise<CustomSkillDetail> {
  try {
    const response = await apiClient.patch<CustomSkillDetail>(
      `/api/skills/${skillId}`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update skill: ${handleApiError(error)}`);
  }
}

export async function deleteCustomSkill(skillId: number): Promise<void> {
  try {
    await apiClient.delete(`/api/skills/${skillId}`);
  } catch (error) {
    throw new Error(`Failed to delete skill: ${handleApiError(error)}`);
  }
}

export async function assignCustomSkill(
  skillId: number,
  request: CustomSkillAssignRequest,
): Promise<CustomSkillDetail> {
  try {
    const response = await apiClient.post<CustomSkillDetail>(
      `/api/skills/${skillId}/assign`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to assign skill: ${handleApiError(error)}`);
  }
}

export async function rebuildCustomSkillIndex(skillId: number): Promise<void> {
  try {
    await apiClient.post(`/api/skills/${skillId}/rebuild`);
  } catch (error) {
    throw new Error(`Failed to rebuild skill index: ${handleApiError(error)}`);
  }
}
