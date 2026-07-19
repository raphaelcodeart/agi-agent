import { apiClient } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query-string";
import { isMockApiEnabled } from "@/lib/env";
import * as mock from "@/lib/api/mock/adapter";
import type { GroupResponse, UserResponse, UserStatus } from "@/types/api";

export interface ListUsersParams {
  skip?: number;
  limit?: number;
  search?: string;
  status_filter?: UserStatus | "";
}

export function listUsers(params: ListUsersParams = {}): Promise<UserResponse[]> {
  if (isMockApiEnabled()) return mock.listUsers(params);
  return apiClient.get<UserResponse[]>(`/users/${buildQueryString(params)}`);
}

export interface UserPayload {
  name: string;
  email: string;
  company_name?: string | null;
  status: UserStatus;
  notes?: string | null;
  group_ids?: string[] | null;
}

export function createUser(payload: UserPayload): Promise<UserResponse> {
  if (isMockApiEnabled()) return mock.createUser(payload);
  return apiClient.post<UserResponse>("/users/", payload);
}

export function getUser(id: string): Promise<UserResponse> {
  if (isMockApiEnabled()) return mock.getUser(id);
  return apiClient.get<UserResponse>(`/users/${id}`);
}

export function updateUser(id: string, payload: Partial<UserPayload>): Promise<UserResponse> {
  if (isMockApiEnabled()) return mock.updateUser(id, payload);
  return apiClient.put<UserResponse>(`/users/${id}`, payload);
}

export function deleteUser(id: string): Promise<void> {
  if (isMockApiEnabled()) return mock.deleteUser(id);
  return apiClient.delete<void>(`/users/${id}`);
}

export function listGroups(): Promise<GroupResponse[]> {
  if (isMockApiEnabled()) return mock.listGroups();
  return apiClient.get<GroupResponse[]>("/users/groups/list");
}

export interface GroupPayload {
  name: string;
  description?: string | null;
}

export function createGroup(payload: GroupPayload): Promise<GroupResponse> {
  if (isMockApiEnabled()) return mock.createGroup(payload);
  return apiClient.post<GroupResponse>("/users/groups", payload);
}
