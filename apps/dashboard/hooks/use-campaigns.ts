"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import * as campaignsService from "@/services/campaigns";
import { queryKeys } from "@/lib/query/keys";
import type { ListCampaignsParams } from "@/services/campaigns";
import type { CampaignCreatePayload, CampaignDetailResponse } from "@/types/api";

export function useCampaigns(params: ListCampaignsParams = {}) {
  return useQuery({
    queryKey: queryKeys.campaigns.list(params),
    queryFn: () => campaignsService.listCampaigns(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCampaignDetail(
  id: string | undefined,
  options?: { refetchInterval?: UseQueryOptions<CampaignDetailResponse>["refetchInterval"] }
) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id ?? ""),
    queryFn: () => campaignsService.getCampaignDetail(id as string),
    enabled: !!id,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CampaignCreatePayload) => campaignsService.createCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", "list"] });
    },
  });
}

export function usePreviewCampaignTargets() {
  return useMutation({
    mutationFn: (payload: CampaignCreatePayload) => campaignsService.previewCampaignTargets(payload),
  });
}

export function useLaunchCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      targetingParams,
      channelOverrides,
    }: {
      campaignId: string;
      targetingParams: Record<string, unknown>;
      channelOverrides?: Record<string, string>;
    }) => campaignsService.launchCampaign(campaignId, targetingParams, channelOverrides),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", "list"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(variables.campaignId) });
    },
  });
}

function useCampaignAction(
  mutationFn: (campaignId: string) => Promise<unknown>,
  campaignId: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", "list"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
      queryClient.invalidateQueries({ queryKey: ["publications", "list"] });
    },
  });
}

export function usePauseCampaign(campaignId: string) {
  return useCampaignAction(campaignsService.pauseCampaign, campaignId);
}

export function useResumeCampaign(campaignId: string) {
  return useCampaignAction(campaignsService.resumeCampaign, campaignId);
}

export function useCancelCampaign(campaignId: string) {
  return useCampaignAction(campaignsService.cancelCampaign, campaignId);
}
