/**
 * Types mirror `apps/api/app/schemas/schemas.py` field-for-field.
 * Do not add fields here that the FastAPI backend does not actually return.
 */

// ==============================================================================
// Auth
// ==============================================================================
export interface AdminResponse {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

// ==============================================================================
// Users & Groups
// ==============================================================================
export type UserStatus = "active" | "inactive" | "suspended";

export interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  status: UserStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  groups: GroupResponse[];
}

// ==============================================================================
// Buffer Connections & Channels
// ==============================================================================
export type BufferConnectionStatus =
  | "pending"
  | "connected"
  | "expired"
  | "revoked"
  | "error"
  | "disconnected";

export interface BufferConnectionResponse {
  id: string;
  user_id: string;
  authentication_type: string;
  external_account_id: string | null;
  status: BufferConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface BufferOrganizationResponse {
  id: string;
  external_organization_id: string;
  name: string;
  is_active: boolean;
}

export type PublicationMode = "automatic" | "notification" | "approval" | "disabled";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "x"
  | "threads";

export interface SocialChannelResponse {
  id: string;
  user_id: string;
  external_channel_id: string;
  platform: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  external_link: string | null;
  channel_type: string | null;
  is_active: boolean;
  auto_publish_enabled: boolean;
  publication_mode: PublicationMode;
  last_sync_at: string | null;
}

// ==============================================================================
// Media
// ==============================================================================
export type MediaProcessingStatus = "uploaded" | "inspecting" | "processing" | "ready" | "failed";
export type MediaValidationStatus = "pending" | "valid" | "warning" | "invalid";

export interface MediaValidationError {
  code?: string;
  message: string;
  [key: string]: unknown;
}

export interface MediaResponse {
  id: string;
  original_filename: string;
  stored_filename: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  checksum: string | null;
  processing_status: MediaProcessingStatus;
  validation_status: MediaValidationStatus;
  validation_errors: MediaValidationError[] | null;
  created_at: string;
}

// ==============================================================================
// Campaigns
// ==============================================================================
export type PublishingMode = "immediate" | "scheduled" | "buffer_queue" | "draft" | "approval";

export type TargetingMode =
  | "all_active_channels"
  | "selected_users"
  | "selected_groups"
  | "selected_channels"
  | "selected_platforms";

export type CampaignStatus =
  | "draft"
  | "preparing"
  | "queued"
  | "running"
  | "paused"
  | "partially_completed"
  | "completed"
  | "failed"
  | "cancelled";

export interface CampaignCreatePayload {
  title: string;
  default_text: string;
  instagram_text?: string | null;
  facebook_text?: string | null;
  linkedin_text?: string | null;
  tiktok_text?: string | null;
  youtube_title?: string | null;
  youtube_description?: string | null;
  x_text?: string | null;
  threads_text?: string | null;
  media_file_id?: string | null;
  article_id?: string | null;
  publishing_mode: PublishingMode;
  scheduled_at?: string | null;
  timezone: string;
  targeting_mode: TargetingMode;
  targeting_params: Record<string, unknown>;
}

export interface CampaignResponse {
  id: string;
  title: string;
  default_text: string;
  instagram_text?: string | null;
  facebook_text?: string | null;
  linkedin_text?: string | null;
  tiktok_text?: string | null;
  youtube_title?: string | null;
  youtube_description?: string | null;
  x_text?: string | null;
  threads_text?: string | null;
  publishing_mode: PublishingMode;
  scheduled_at: string | null;
  timezone: string;
  targeting_mode: TargetingMode;
  metadata_json?: Record<string, unknown> | null;
  status: CampaignStatus;
  media_file_id: string | null;
  article_id?: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CampaignPreviewResponse {
  estimated_publications_count: number;
  total_users_targeted: number;
  platform_distribution: Record<string, number>;
  channels_requiring_notification_approval: number;
  excluded_channels_count: number;
  total_active_users: number;
}

export type PublicationStatsMap = Record<
  | "pending"
  | "queued"
  | "processing"
  | "submitted"
  | "scheduled"
  | "published"
  | "retry_wait"
  | "failed"
  | "cancelled"
  | "skipped"
  | "unknown",
  number
>;

export interface CampaignDetailResponse {
  campaign: CampaignResponse;
  media: MediaResponse | null;
  stats: PublicationStatsMap;
  progress_percentage: number;
}

export interface PostMetricValue {
  type: string;
  name: string;
  value: number;
  unit: string;
}

export interface ChannelMetrics {
  publication_id: string;
  social_channel_id: string;
  channel_name: string;
  user_name: string;
  platform: string;
  external_post_url: string | null;
  metrics: PostMetricValue[];
  metrics_updated_at: string | null;
  error: string | null;
}

export interface AISettingsResponse {
  configured: boolean;
  model: string;
}

export interface AISettingsUpdatePayload {
  openai_api_key?: string;
  openai_model?: string;
}

export interface AIGenerateTextResponse {
  default_text: string;
  instagram_text: string;
  facebook_text: string;
  linkedin_text: string;
  tiktok_text: string;
  x_text: string;
  threads_text: string;
  youtube_title: string;
  youtube_description: string;
}

export interface CampaignMetricsResponse {
  totals: Record<string, number>;
  channels: ChannelMetrics[];
}

// ==============================================================================
// Publications
// ==============================================================================
export type PublicationStatus =
  | "pending"
  | "queued"
  | "processing"
  | "submitted"
  | "scheduled"
  | "published"
  | "retry_wait"
  | "failed"
  | "cancelled"
  | "skipped"
  | "unknown";

export interface PublicationResponse {
  id: string;
  campaign_id: string;
  user_id: string;
  social_channel_id: string;
  external_channel_id: string;
  status: PublicationStatus;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
  scheduled_at: string | null;
  next_attempt_at: string | null;
  processing_started_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  external_post_url: string | null;
  error_category: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicationAttemptResponse {
  id: string;
  publication_id: string;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  success: boolean;
  http_status: number | null;
  external_error_code: string | null;
  error_category: string | null;
  error_message: string | null;
  sanitized_request: Record<string, unknown> | null;
  sanitized_response: Record<string, unknown> | null;
  duration_ms: number | null;
}

export interface PublicationDetailResponse {
  publication: PublicationResponse;
  attempts: PublicationAttemptResponse[];
  resolved_text: string;
  channel_name: string;
  channel_platform: string;
  user_name: string;
}

// ==============================================================================
// Settings
// ==============================================================================
export interface SystemSettingsResponse {
  global_concurrency_limit: number;
  concurrent_jobs_per_connection: number;
  pause_between_requests_seconds: number;
  max_publication_attempts: number;
  upload_max_size_bytes: number;
  buffer_integration_mode: string;
  celery_queue_health: string;
}

export interface SystemSettingsUpdatePayload {
  global_concurrency_limit: number;
  concurrent_jobs_per_connection: number;
  pause_between_requests_seconds: number;
  max_publication_attempts: number;
  upload_max_size_bytes: number;
}

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  database: "ok" | "failed";
  redis: "ok" | "failed";
  celery_worker: "ok" | "inactive" | "failed";
  timestamp: string;
}

// ==============================================================================
// Blog Writer AI
// ==============================================================================
export type WordpressConnectionStatus = "untested" | "connected" | "error";

export interface WordpressSiteResponse {
  id: string;
  user_id: string | null;
  name: string;
  site_url: string;
  api_url: string;
  username: string;
  default_author_id: number | null;
  default_author_name: string | null;
  default_category_id: number | null;
  default_category_name: string | null;
  default_status: string;
  language: string;
  is_active: boolean;
  connection_status: WordpressConnectionStatus;
  last_connection_test_at: string | null;
  last_connection_error: string | null;
  last_published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WordpressSiteCreatePayload {
  user_id?: string | null;
  name: string;
  site_url: string;
  api_url: string;
  username: string;
  application_password: string;
  default_author_id?: number | null;
  default_category_id?: number | null;
  default_status: string;
  language: string;
}

export interface WordpressSiteUpdatePayload {
  user_id?: string | null;
  name?: string;
  site_url?: string;
  api_url?: string;
  username?: string;
  application_password?: string;
  default_author_id?: number | null;
  default_category_id?: number | null;
  default_status?: string;
  language?: string;
  is_active?: boolean;
}

export interface WordpressOptionItem {
  id: number;
  name: string;
}

export interface WordpressTestConnectionResponse {
  success: boolean;
  message: string;
  wp_user_name: string | null;
}

export type BlogArticleStatus =
  | "generating"
  | "draft"
  | "ready"
  | "publishing"
  | "partially_published"
  | "published"
  | "failed"
  | "archived";

export interface BlogArticleCreatePayload {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  hashtags: string[];
  meta_title?: string;
  meta_description?: string;
  language: string;
  user_id?: string | null;
}

export interface BlogArticleGeneratePayload {
  topic: string;
  description?: string;
  goal?: string;
  target_audience?: string;
  language: string;
  tone?: string;
  length: "short" | "medium" | "long";
  primary_keyword?: string;
  secondary_keywords: string[];
  must_include?: string;
  must_avoid?: string;
  call_to_action?: string;
  hashtag_count: number;
  wordpress_site_id?: string | null;
  wordpress_category_id?: number | null;
  user_id?: string | null;
}

export interface BlogArticleUpdatePayload {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  hashtags?: string[];
  meta_title?: string;
  meta_description?: string;
}

export interface BlogArticleResponse {
  id: string;
  user_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  hashtags: string[] | null;
  primary_keyword: string | null;
  secondary_keywords: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  language: string;
  tone: string | null;
  target_audience: string | null;
  article_goal: string | null;
  generation_model: string | null;
  status: BlogArticleStatus;
  created_at: string;
  updated_at: string;
  last_edited_at: string | null;
  published_at: string | null;
}

export interface BlogArticleListItem {
  id: string;
  title: string;
  language: string;
  status: BlogArticleStatus;
  created_at: string;
  updated_at: string;
  sites_count: number;
  publications_count: number;
}

export type BlogPublicationStatus = "pending" | "publishing" | "published" | "failed" | "retrying" | "removed" | "updated";

export interface BlogPublicationResponse {
  id: string;
  article_id: string;
  wordpress_site_id: string;
  wordpress_site_name: string;
  wordpress_post_id: number | null;
  wordpress_post_url: string | null;
  wordpress_status: string | null;
  publication_status: BlogPublicationStatus;
  error_message: string | null;
  retry_count: number;
  published_at: string | null;
  created_at: string;
}

export interface BlogArticleDetailResponse {
  article: BlogArticleResponse;
  publications: BlogPublicationResponse[];
  social_campaigns: CampaignResponse[];
}

export interface BlogPublishTarget {
  wordpress_site_id: string;
  category_id?: number | null;
  author_id?: number | null;
  status?: string | null;
}

export interface SocialPreviewResponse {
  article_url: string;
  default_text: string;
  instagram_text: string;
  facebook_text: string;
  linkedin_text: string;
  x_text: string;
  threads_text: string;
}

export interface BlogWriterDashboardResponse {
  draft_count: number;
  ready_count: number;
  published_count: number;
  failed_publications_count: number;
  sites_count: number;
  sites_error_count: number;
  social_campaigns_count: number;
  recent_articles: BlogArticleListItem[];
  recent_publications: BlogPublicationResponse[];
}
