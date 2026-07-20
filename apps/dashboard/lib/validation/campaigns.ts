import { z } from "zod";
import type { CampaignCreatePayload, CampaignResponse } from "@/types/api";

export const publishingModeValues = [
  "immediate",
  "scheduled",
  "buffer_queue",
  "draft",
  "approval",
] as const;

export const targetingModeValues = [
  "all_active_channels",
  "selected_users",
  "selected_groups",
  "selected_channels",
  "selected_platforms",
] as const;

export const campaignWizardSchema = z
  .object({
    // Step 1 - Info
    title: z.string().min(1, "Il titolo è obbligatorio").max(255),

    // Step 2 - Text
    default_text: z.string().min(1, "Il testo predefinito è obbligatorio").max(5000),
    instagram_text: z.string().max(5000).optional().or(z.literal("")),
    facebook_text: z.string().max(5000).optional().or(z.literal("")),
    linkedin_text: z.string().max(5000).optional().or(z.literal("")),
    tiktok_text: z.string().max(5000).optional().or(z.literal("")),
    youtube_title: z.string().max(100).optional().or(z.literal("")),
    youtube_description: z.string().max(5000).optional().or(z.literal("")),
    x_text: z.string().max(280).optional().or(z.literal("")),
    threads_text: z.string().max(500).optional().or(z.literal("")),

    // Step 3 - Media
    media_file_id: z.string().optional().nullable(),

    // Step 4 - Recipients
    targeting_mode: z.enum(targetingModeValues),
    user_ids: z.array(z.string()).optional(),
    group_ids: z.array(z.string()).optional(),
    channel_ids: z.array(z.string()).optional(),
    platform_names: z.array(z.string()).optional(),

    // Step 5 - Scheduling
    publishing_mode: z.enum(publishingModeValues),
    scheduled_at: z.string().optional().nullable(),
    timezone: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.publishing_mode === "scheduled" && !data.scheduled_at) {
      ctx.addIssue({
        code: "custom",
        message: "Seleziona una data di programmazione",
        path: ["scheduled_at"],
      });
    }
    if (data.targeting_mode === "selected_users" && !data.user_ids?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Seleziona almeno un utente",
        path: ["user_ids"],
      });
    }
    if (data.targeting_mode === "selected_groups" && !data.group_ids?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Seleziona almeno un gruppo",
        path: ["group_ids"],
      });
    }
    if (data.targeting_mode === "selected_channels" && !data.channel_ids?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Seleziona almeno un canale",
        path: ["channel_ids"],
      });
    }
    if (data.targeting_mode === "selected_platforms" && !data.platform_names?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Seleziona almeno una piattaforma",
        path: ["platform_names"],
      });
    }
  });

export type CampaignWizardValues = z.infer<typeof campaignWizardSchema>;

export const WIZARD_STEP_FIELDS: (keyof CampaignWizardValues)[][] = [
  ["title"],
  ["default_text"],
  ["media_file_id"],
  ["targeting_mode", "user_ids", "group_ids", "channel_ids", "platform_names"],
  ["publishing_mode", "scheduled_at", "timezone"],
  [],
];

export const WIZARD_STEPS = [
  "Informazioni",
  "Testo",
  "Media",
  "Destinatari",
  "Programmazione",
  "Riepilogo",
] as const;

export function toCampaignCreatePayload(values: CampaignWizardValues): CampaignCreatePayload {
  return {
    title: values.title,
    default_text: values.default_text,
    instagram_text: values.instagram_text || null,
    facebook_text: values.facebook_text || null,
    linkedin_text: values.linkedin_text || null,
    tiktok_text: values.tiktok_text || null,
    youtube_title: values.youtube_title || null,
    youtube_description: values.youtube_description || null,
    x_text: values.x_text || null,
    threads_text: values.threads_text || null,
    media_file_id: values.media_file_id || null,
    publishing_mode: values.publishing_mode,
    scheduled_at: values.scheduled_at ? new Date(values.scheduled_at).toISOString() : null,
    timezone: values.timezone,
    targeting_mode: values.targeting_mode,
    targeting_params: buildTargetingParams(values),
  };
}

// Prefills the wizard from an existing campaign ("Duplica campagna"). Text,
// media and recipient selection are copied as-is; publishing mode and
// scheduled_at are deliberately reset so the admin has to actively re-pick
// them rather than silently reusing a possibly past/one-off schedule.
export function campaignToWizardDefaults(campaign: CampaignResponse): Partial<CampaignWizardValues> {
  const params = (campaign.metadata_json ?? {}) as Record<string, unknown>;
  const asStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

  return {
    title: `${campaign.title} (copia)`,
    default_text: campaign.default_text,
    instagram_text: campaign.instagram_text ?? "",
    facebook_text: campaign.facebook_text ?? "",
    linkedin_text: campaign.linkedin_text ?? "",
    tiktok_text: campaign.tiktok_text ?? "",
    youtube_title: campaign.youtube_title ?? "",
    youtube_description: campaign.youtube_description ?? "",
    x_text: campaign.x_text ?? "",
    threads_text: campaign.threads_text ?? "",
    media_file_id: campaign.media_file_id,
    targeting_mode: campaign.targeting_mode,
    user_ids: asStringArray(params.user_ids),
    group_ids: asStringArray(params.group_ids),
    channel_ids: asStringArray(params.channel_ids),
    platform_names: asStringArray(params.platform_names),
    publishing_mode: "immediate",
    scheduled_at: null,
    timezone: campaign.timezone,
  };
}

export function buildTargetingParams(values: CampaignWizardValues): Record<string, unknown> {
  switch (values.targeting_mode) {
    case "selected_users":
      return { user_ids: values.user_ids ?? [] };
    case "selected_groups":
      return { group_ids: values.group_ids ?? [] };
    case "selected_channels":
      return { channel_ids: values.channel_ids ?? [] };
    case "selected_platforms":
      return { platform_names: values.platform_names ?? [] };
    default:
      return {};
  }
}
