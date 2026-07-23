"use client";

import { useMutation } from "@tanstack/react-query";
import * as aiService from "@/services/ai";

export function useGenerateCampaignText() {
  return useMutation({
    mutationFn: (topic: string) => aiService.generateCampaignText(topic),
  });
}
