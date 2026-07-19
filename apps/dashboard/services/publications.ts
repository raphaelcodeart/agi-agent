import { apiClient } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query-string";
import { isMockApiEnabled } from "@/lib/env";
import * as mock from "@/lib/api/mock/adapter";
import type { PublicationDetailResponse, PublicationResponse, PublicationStatus } from "@/types/api";

export interface ListPublicationsParams {
  campaign_id?: string;
  status_filter?: PublicationStatus | "";
  skip?: number;
  limit?: number;
}

export function listPublications(params: ListPublicationsParams = {}): Promise<PublicationResponse[]> {
  if (isMockApiEnabled()) return mock.listPublications(params);
  return apiClient.get<PublicationResponse[]>(`/publications/${buildQueryString(params)}`);
}

export function getPublication(id: string): Promise<PublicationDetailResponse> {
  if (isMockApiEnabled()) return mock.getPublication(id);
  return apiClient.get<PublicationDetailResponse>(`/publications/${id}`);
}

export function retryPublication(id: string): Promise<PublicationResponse> {
  if (isMockApiEnabled()) return mock.retryPublication(id);
  return apiClient.post<PublicationResponse>(`/publications/${id}/retry`);
}

export function retrySelectedPublications(ids: string[]): Promise<{ message: string }> {
  if (isMockApiEnabled()) return mock.retrySelectedPublications(ids);
  // Sole body parameter is a bare List[uuid.UUID] -> raw JSON array, not wrapped.
  return apiClient.post<{ message: string }>("/publications/retry-selected", ids);
}

export function retryCampaignFailures(campaignId: string): Promise<{ message: string }> {
  if (isMockApiEnabled()) return mock.retryCampaignFailures(campaignId);
  return apiClient.post<{ message: string }>(`/publications/retry-campaign-failures/${campaignId}`);
}

export function cancelPublication(id: string): Promise<PublicationResponse> {
  if (isMockApiEnabled()) return mock.cancelPublication(id);
  return apiClient.post<PublicationResponse>(`/publications/${id}/cancel`);
}

export function skipPublication(id: string): Promise<PublicationResponse> {
  if (isMockApiEnabled()) return mock.skipPublication(id);
  return apiClient.post<PublicationResponse>(`/publications/${id}/skip`);
}
