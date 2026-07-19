"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as mediaService from "@/services/media";
import { queryKeys } from "@/lib/query/keys";

export function useMediaList() {
  return useQuery({
    queryKey: queryKeys.media.list(),
    queryFn: mediaService.listMedia,
    refetchInterval: 10_000,
  });
}

export function useMediaDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.media.detail(id ?? ""),
    queryFn: () => mediaService.getMedia(id as string),
    enabled: !!id,
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => mediaService.uploadMedia(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.list() });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mediaService.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.list() });
    },
  });
}
