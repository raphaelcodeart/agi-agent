import { apiClient } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/env";
import * as mock from "@/lib/api/mock/adapter";
import type { HealthResponse, SystemSettingsResponse, SystemSettingsUpdatePayload } from "@/types/api";

export function getSettings(): Promise<SystemSettingsResponse> {
  if (isMockApiEnabled()) return mock.getSettings();
  return apiClient.get<SystemSettingsResponse>("/settings/");
}

export function updateSettings(payload: SystemSettingsUpdatePayload): Promise<SystemSettingsResponse> {
  if (isMockApiEnabled()) return mock.updateSettings(payload);
  return apiClient.put<SystemSettingsResponse>("/settings/", payload);
}

export function getHealth(): Promise<HealthResponse> {
  if (isMockApiEnabled()) return mock.getHealth();
  return apiClient.get<HealthResponse>("/settings/health");
}
