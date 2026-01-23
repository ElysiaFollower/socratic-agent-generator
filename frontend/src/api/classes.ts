/**
 * Class API service.
 */

import { apiClient, handleApiError } from "./client";
import {
  ClassInfo,
  ClassMemberInfo,
  CreateClassRequest,
  GenerateInvitationCodeRequest,
  GenerateInvitationCodeResponse,
  InvitationCodeListResponse,
  JoinClassRequest,
  Profile,
  UpdateProfileVisibilityRequest,
} from "../types";

export async function listClasses(): Promise<readonly ClassInfo[]> {
  try {
    const response = await apiClient.get<readonly ClassInfo[]>("/api/classes");
    return response.data;
  } catch (error) {
    throw new Error(`加载班级失败: ${handleApiError(error)}`);
  }
}

export async function createClass(
  request: CreateClassRequest,
): Promise<ClassInfo> {
  try {
    const response = await apiClient.post<ClassInfo>("/api/classes", request);
    return response.data;
  } catch (error) {
    throw new Error(`创建班级失败: ${handleApiError(error)}`);
  }
}

export async function joinClass(request: JoinClassRequest): Promise<ClassInfo> {
  try {
    const response = await apiClient.post<ClassInfo>(
      "/api/classes/join",
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`加入班级失败: ${handleApiError(error)}`);
  }
}

export async function generateClassInvitationCode(
  request: GenerateInvitationCodeRequest,
): Promise<GenerateInvitationCodeResponse> {
  try {
    const response = await apiClient.post<GenerateInvitationCodeResponse>(
      `/api/classes/${request.class_id}/invite`,
      { expires_in_days: request.expires_in_days ?? 30 },
    );
    return response.data;
  } catch (error) {
    throw new Error(`生成邀请码失败: ${handleApiError(error)}`);
  }
}

export async function listClassInvitations(
  classId: string,
): Promise<InvitationCodeListResponse> {
  try {
    const response = await apiClient.get<InvitationCodeListResponse>(
      `/api/classes/${classId}/invites`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`加载邀请码失败: ${handleApiError(error)}`);
  }
}

export async function listClassMembers(
  classId: string,
): Promise<readonly ClassMemberInfo[]> {
  try {
    const response = await apiClient.get<readonly ClassMemberInfo[]>(
      `/api/classes/${classId}/members`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`加载成员失败: ${handleApiError(error)}`);
  }
}

export async function updateProfileVisibility(
  classId: string,
  profileId: string,
  request: UpdateProfileVisibilityRequest,
): Promise<Profile> {
  try {
    const response = await apiClient.patch<Profile>(
      `/api/classes/${classId}/profiles/${profileId}`,
      request,
    );
    return response.data;
  } catch (error) {
    throw new Error(`更新可见性失败: ${handleApiError(error)}`);
  }
}

export async function deleteClassInvitationCode(
  classId: string,
  code: string,
): Promise<void> {
  try {
    await apiClient.delete(`/api/classes/${classId}/invites/${code}`);
  } catch (error) {
    throw new Error(`删除邀请码失败: ${handleApiError(error)}`);
  }
}

export async function updateClassInvitationCode(
  classId: string,
  code: string,
  expiresInDays: number,
): Promise<GenerateInvitationCodeResponse> {
  try {
    const response = await apiClient.patch<GenerateInvitationCodeResponse>(
      `/api/classes/${classId}/invites/${code}`,
      { expires_in_days: expiresInDays },
    );
    return response.data;
  } catch (error) {
    throw new Error(`更新邀请码失败: ${handleApiError(error)}`);
  }
}

export async function deleteClass(classId: string): Promise<void> {
  try {
    await apiClient.delete(`/api/classes/${classId}`);
  } catch (error) {
    throw new Error(`删除班级失败: ${handleApiError(error)}`);
  }
}

export async function leaveClass(classId: string): Promise<void> {
  try {
    await apiClient.delete(`/api/classes/${classId}/leave`);
  } catch (error) {
    throw new Error(`离开班级失败: ${handleApiError(error)}`);
  }
}
