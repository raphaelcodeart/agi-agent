import { apiClient } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/env";
import * as mock from "@/lib/api/mock/adapter";
import type { MediaResponse } from "@/types/api";

export function listMedia(): Promise<MediaResponse[]> {
  if (isMockApiEnabled()) return mock.listMedia();
  return apiClient.get<MediaResponse[]>("/media/");
}

export function uploadMedia(file: File): Promise<MediaResponse> {
  if (isMockApiEnabled()) return mock.uploadMedia(file);
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post<MediaResponse>("/media/upload", formData);
}

export function getMedia(id: string): Promise<MediaResponse> {
  if (isMockApiEnabled()) return mock.getMedia(id);
  return apiClient.get<MediaResponse>(`/media/${id}`);
}

export function renameMedia(id: string, originalFilename: string): Promise<MediaResponse> {
  if (isMockApiEnabled()) return mock.renameMedia(id, originalFilename);
  return apiClient.patch<MediaResponse>(`/media/${id}`, { original_filename: originalFilename });
}

export function deleteMedia(id: string): Promise<void> {
  if (isMockApiEnabled()) return mock.deleteMedia(id);
  return apiClient.delete<void>(`/media/${id}`);
}
