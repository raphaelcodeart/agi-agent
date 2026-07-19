"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as settingsService from "@/services/settings";
import { queryKeys } from "@/lib/query/keys";
import type { SystemSettingsUpdatePayload } from "@/types/api";

export function useSystemSettings() {
  return useQuery({
    queryKey: queryKeys.settings.detail(),
    queryFn: settingsService.getSettings,
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SystemSettingsUpdatePayload) => settingsService.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.detail() });
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.settings.health(),
    queryFn: settingsService.getHealth,
    refetchInterval: 30_000,
  });
}
