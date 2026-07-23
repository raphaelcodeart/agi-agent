"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as publicationsService from "@/services/publications";
import { queryKeys } from "@/lib/query/keys";
import type { ListPublicationsParams } from "@/services/publications";
import type { ChannelMetrics } from "@/types/api";

export function usePublications(params: ListPublicationsParams = {}) {
  return useQuery({
    queryKey: queryKeys.publications.list(params),
    queryFn: () => publicationsService.listPublications(params),
    placeholderData: (previousData) => previousData,
  });
}

export function usePublicationDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publications.detail(id ?? ""),
    queryFn: () => publicationsService.getPublication(id as string),
    enabled: !!id,
  });
}

// On-demand only (never polled), same reasoning as useCampaignMetrics: Buffer
// refreshes post metrics once a day, so the admin explicitly asks via a button.
export function usePublicationMetrics(id: string) {
  return useQuery<ChannelMetrics>({
    queryKey: queryKeys.publications.metrics(id),
    queryFn: () => publicationsService.getPublicationMetrics(id),
    enabled: false,
    retry: false,
  });
}

function invalidatePublications(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["publications", "list"] });
  queryClient.invalidateQueries({ queryKey: ["campaigns"] });
}

export function useRetryPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publicationsService.retryPublication(id),
    onSuccess: () => invalidatePublications(queryClient),
  });
}

export function useRetrySelectedPublications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => publicationsService.retrySelectedPublications(ids),
    onSuccess: () => invalidatePublications(queryClient),
  });
}

export function useRetryCampaignFailures() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => publicationsService.retryCampaignFailures(campaignId),
    onSuccess: () => invalidatePublications(queryClient),
  });
}

export function useCancelPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publicationsService.cancelPublication(id),
    onSuccess: () => invalidatePublications(queryClient),
  });
}

export function useSkipPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publicationsService.skipPublication(id),
    onSuccess: () => invalidatePublications(queryClient),
  });
}
