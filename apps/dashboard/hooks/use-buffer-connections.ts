"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as connectionsService from "@/services/buffer-connections";
import { queryKeys } from "@/lib/query/keys";

export function useBufferConnections() {
  return useQuery({
    queryKey: queryKeys.bufferConnections.list(),
    queryFn: connectionsService.listConnections,
    refetchInterval: 30_000,
  });
}

export function useConnectOAuthUrl() {
  return useMutation({
    mutationFn: (userId: string) => connectionsService.getOAuthUrl(userId),
  });
}

export function useSyncConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => connectionsService.syncConnection(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bufferConnections.list() });
      queryClient.invalidateQueries({ queryKey: ["channels", "list"] });
    },
  });
}

export function useDisconnectConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => connectionsService.disconnectConnection(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bufferConnections.list() });
      queryClient.invalidateQueries({ queryKey: ["channels", "list"] });
    },
  });
}
