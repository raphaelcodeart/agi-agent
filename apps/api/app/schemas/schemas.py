import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# ==============================================================================
# Authentication Schemas
# ==============================================================================
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class AdminResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==============================================================================
# User & Group Schemas
# ==============================================================================
class GroupCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    name: str = Field(..., max_length=255)
    email: EmailStr
    company_name: Optional[str] = Field(None, max_length=255)
    status: str = Field("active", description="active, inactive, suspended")
    notes: Optional[str] = Field(None, max_length=1000)
    group_ids: Optional[List[uuid.UUID]] = None

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    company_name: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)
    group_ids: Optional[List[uuid.UUID]] = None

class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    company_name: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    groups: List[GroupResponse] = []

    class Config:
        from_attributes = True


# ==============================================================================
# Buffer Connection & Channel Schemas
# ==============================================================================
class BufferConnectionCreateRequest(BaseModel):
    user_id: uuid.UUID
    api_key: str = Field(min_length=1)

class BufferConnectionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    authentication_type: str
    external_account_id: Optional[str]
    status: str
    last_sync_at: Optional[datetime]
    last_error: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class BufferOrganizationResponse(BaseModel):
    id: uuid.UUID
    external_organization_id: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True

class SocialChannelResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    external_channel_id: str
    platform: str
    name: str
    username: Optional[str]
    avatar_url: Optional[str]
    external_link: Optional[str]
    channel_type: Optional[str]
    is_active: bool
    auto_publish_enabled: bool
    publication_mode: str
    last_sync_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==============================================================================
# Media Schemas
# ==============================================================================
class MediaResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    stored_filename: str
    public_url: str
    mime_type: str
    size_bytes: int
    duration_seconds: Optional[float]
    width: Optional[int]
    height: Optional[int]
    aspect_ratio: Optional[str]
    video_codec: Optional[str]
    audio_codec: Optional[str]
    checksum: Optional[str]
    processing_status: str
    validation_status: str
    validation_errors: Optional[List[Dict[str, Any]]]
    created_at: datetime

    class Config:
        from_attributes = True


class MediaRenameRequest(BaseModel):
    original_filename: str = Field(..., min_length=1, max_length=255)


# ==============================================================================
# AI Content Generation Schemas
# ==============================================================================
class AISettingsResponse(BaseModel):
    configured: bool
    model: str


class AISettingsUpdateRequest(BaseModel):
    # None/omitted = leave unchanged. An explicit empty string is rejected by
    # the endpoint (use DELETE /settings/ai to remove the key instead), so this
    # is never ambiguous between "don't touch" and "clear it".
    openai_api_key: Optional[str] = Field(None, min_length=1, max_length=500)
    openai_model: Optional[str] = Field(None, min_length=1, max_length=100)


class AIGenerateTextRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=1000)


class AIGenerateTextResponse(BaseModel):
    default_text: str
    instagram_text: str
    facebook_text: str
    linkedin_text: str
    tiktok_text: str
    x_text: str
    threads_text: str
    youtube_title: str
    youtube_description: str


# ==============================================================================
# Campaign & Targeting Schemas
# ==============================================================================
class CampaignCreate(BaseModel):
    title: str = Field(..., max_length=255)
    default_text: str = Field(..., max_length=5000)
    instagram_text: Optional[str] = Field(None, max_length=5000)
    facebook_text: Optional[str] = Field(None, max_length=5000)
    linkedin_text: Optional[str] = Field(None, max_length=5000)
    tiktok_text: Optional[str] = Field(None, max_length=5000)
    youtube_title: Optional[str] = Field(None, max_length=100)
    youtube_description: Optional[str] = Field(None, max_length=5000)
    x_text: Optional[str] = Field(None, max_length=280)
    threads_text: Optional[str] = Field(None, max_length=500)
    media_file_id: Optional[uuid.UUID] = None
    publishing_mode: str = Field("immediate", description="immediate, scheduled, buffer_queue, draft, approval")
    scheduled_at: Optional[datetime] = None
    timezone: str = "UTC"
    targeting_mode: str = "all_active_channels"
    targeting_params: Dict[str, Any] = Field(default_factory=dict, description="Must match targeting mode selections")
    # Set only when this campaign was created via Blog Writer's "Usa per campagna
    # social" - purely informational (see Campaign.article_id), never required.
    article_id: Optional[uuid.UUID] = None

class CampaignResponse(BaseModel):
    id: uuid.UUID
    title: str
    default_text: str
    instagram_text: Optional[str] = None
    facebook_text: Optional[str] = None
    linkedin_text: Optional[str] = None
    tiktok_text: Optional[str] = None
    youtube_title: Optional[str] = None
    youtube_description: Optional[str] = None
    x_text: Optional[str] = None
    threads_text: Optional[str] = None
    publishing_mode: str
    scheduled_at: Optional[datetime]
    timezone: str
    targeting_mode: str
    # Targeting params used at launch (e.g. {"channel_ids": [...]}), needed to
    # reproduce the same recipient selection when duplicating a campaign.
    metadata_json: Optional[Dict[str, Any]] = None
    status: str
    media_file_id: Optional[uuid.UUID]
    article_id: Optional[uuid.UUID] = None
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class CampaignPreviewResponse(BaseModel):
    estimated_publications_count: int
    total_users_targeted: int
    platform_distribution: Dict[str, int]
    channels_requiring_notification_approval: int
    excluded_channels_count: int
    total_active_users: int

class CampaignDetailResponse(BaseModel):
    campaign: CampaignResponse
    media: Optional[MediaResponse]
    stats: Dict[str, int]
    progress_percentage: float

    class Config:
        from_attributes = True


class PostMetricValue(BaseModel):
    type: str
    name: str
    value: float
    unit: str


class ChannelMetrics(BaseModel):
    publication_id: uuid.UUID
    social_channel_id: uuid.UUID
    channel_name: str
    user_name: str
    platform: str
    external_post_url: Optional[str] = None
    metrics: List[PostMetricValue] = []
    metrics_updated_at: Optional[datetime] = None
    error: Optional[str] = None


class CampaignMetricsResponse(BaseModel):
    # Sum of each metric type across every channel that returned data (e.g.
    # {"reactions": 45, "views": 900, "follows": 3}). A metric type absent here
    # means no channel in this campaign reported it, not that it was zero.
    totals: Dict[str, float]
    channels: List[ChannelMetrics]


# ==============================================================================
# Publication Schemas
# ==============================================================================
class PublicationResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    user_id: uuid.UUID
    social_channel_id: uuid.UUID
    external_channel_id: str
    status: str
    attempt_count: int
    max_attempts: int
    idempotency_key: str
    scheduled_at: Optional[datetime]
    next_attempt_at: Optional[datetime]
    processing_started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    published_at: Optional[datetime]
    external_post_id: Optional[str]
    external_post_url: Optional[str]
    error_category: Optional[str]
    error_code: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PublicationAttemptResponse(BaseModel):
    id: uuid.UUID
    publication_id: uuid.UUID
    attempt_number: int
    started_at: datetime
    completed_at: Optional[datetime]
    success: bool
    http_status: Optional[int]
    external_error_code: Optional[str]
    error_category: Optional[str]
    error_message: Optional[str]
    sanitized_request: Optional[Dict[str, Any]]
    sanitized_response: Optional[Dict[str, Any]]
    duration_ms: Optional[int]

    class Config:
        from_attributes = True

class PublicationDetailResponse(BaseModel):
    publication: PublicationResponse
    attempts: List[PublicationAttemptResponse]
    resolved_text: str
    channel_name: str
    channel_platform: str
    user_name: str


# ==============================================================================
# System & Settings Schemas
# ==============================================================================
class SystemSettingsUpdate(BaseModel):
    global_concurrency_limit: int = Field(..., ge=1, le=100)
    concurrent_jobs_per_connection: int = Field(..., ge=1, le=20)
    pause_between_requests_seconds: int = Field(..., ge=0, le=120)
    max_publication_attempts: int = Field(..., ge=1, le=10)
    upload_max_size_bytes: int = Field(..., ge=1024*1024)

class SystemSettingsResponse(BaseModel):
    global_concurrency_limit: int
    concurrent_jobs_per_connection: int
    pause_between_requests_seconds: int
    max_publication_attempts: int
    upload_max_size_bytes: int
    buffer_integration_mode: str
    celery_queue_health: str = "ok"

class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    celery_worker: str
    timestamp: datetime


# ==============================================================================
# Blog Writer AI Schemas
# ==============================================================================

class WordpressSiteCreate(BaseModel):
    user_id: Optional[uuid.UUID] = None
    name: str = Field(..., max_length=255)
    site_url: str = Field(..., max_length=1000)
    api_url: str = Field(..., max_length=1000, description="WordPress REST API root, e.g. https://example.com/wp-json")
    username: str = Field(..., max_length=255)
    application_password: str = Field(..., min_length=1, max_length=500)
    default_author_id: Optional[int] = None
    default_category_id: Optional[int] = None
    default_status: str = Field("draft", description="publish, draft, pending, private")
    language: str = Field("it", max_length=10)


class WordpressSiteUpdate(BaseModel):
    user_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(None, max_length=255)
    site_url: Optional[str] = Field(None, max_length=1000)
    api_url: Optional[str] = Field(None, max_length=1000)
    username: Optional[str] = Field(None, max_length=255)
    # Omitted = keep existing password. Present = replace it. There is no
    # "clear the password" case - a site without one can't publish, so removal
    # only happens via DELETE on the whole site.
    application_password: Optional[str] = Field(None, min_length=1, max_length=500)
    default_author_id: Optional[int] = None
    default_category_id: Optional[int] = None
    default_status: Optional[str] = None
    language: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = None


class WordpressSiteResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    name: str
    site_url: str
    api_url: str
    username: str
    default_author_id: Optional[int]
    default_author_name: Optional[str]
    default_category_id: Optional[int]
    default_category_name: Optional[str]
    default_status: str
    language: str
    is_active: bool
    connection_status: str
    last_connection_test_at: Optional[datetime]
    last_connection_error: Optional[str]
    last_published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WordpressOptionItem(BaseModel):
    id: int
    name: str


class WordpressTestConnectionResponse(BaseModel):
    success: bool
    message: str
    wp_user_name: Optional[str] = None


class BlogArticleGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    goal: Optional[str] = Field(None, max_length=500)
    target_audience: Optional[str] = Field(None, max_length=500)
    language: str = Field("it", max_length=10)
    tone: Optional[str] = Field(None, max_length=100)
    length: str = Field("medium", description="short, medium, long")
    primary_keyword: Optional[str] = Field(None, max_length=255)
    secondary_keywords: List[str] = Field(default_factory=list)
    must_include: Optional[str] = Field(None, max_length=1000)
    must_avoid: Optional[str] = Field(None, max_length=1000)
    call_to_action: Optional[str] = Field(None, max_length=255)
    hashtag_count: int = Field(5, ge=0, le=15)
    wordpress_site_id: Optional[uuid.UUID] = None
    wordpress_category_id: Optional[int] = None
    user_id: Optional[uuid.UUID] = None


class BlogArticleUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    excerpt: Optional[str] = Field(None, max_length=1000)
    content: Optional[str] = None
    hashtags: Optional[List[str]] = None
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=500)


class BlogPublicationResponse(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    wordpress_site_id: uuid.UUID
    wordpress_site_name: str
    wordpress_post_id: Optional[int]
    wordpress_post_url: Optional[str]
    wordpress_status: Optional[str]
    publication_status: str
    error_message: Optional[str]
    retry_count: int
    published_at: Optional[datetime]
    created_at: datetime


class BlogArticleResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    title: str
    slug: str
    excerpt: Optional[str]
    content: str
    hashtags: Optional[List[str]]
    primary_keyword: Optional[str]
    secondary_keywords: Optional[List[str]]
    meta_title: Optional[str]
    meta_description: Optional[str]
    language: str
    tone: Optional[str]
    target_audience: Optional[str]
    article_goal: Optional[str]
    generation_model: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    last_edited_at: Optional[datetime]
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class BlogArticleDetailResponse(BaseModel):
    article: BlogArticleResponse
    publications: List[BlogPublicationResponse]
    social_campaigns: List[CampaignResponse]


class BlogArticleListItem(BaseModel):
    id: uuid.UUID
    title: str
    language: str
    status: str
    created_at: datetime
    updated_at: datetime
    sites_count: int
    publications_count: int


class BlogPublishTarget(BaseModel):
    wordpress_site_id: uuid.UUID
    category_id: Optional[int] = None
    author_id: Optional[int] = None
    status: Optional[str] = Field(None, description="Overrides the site's default_status for this publish")


class BlogArticlePublishRequest(BaseModel):
    targets: List[BlogPublishTarget] = Field(..., min_length=1)


class SocialPreviewRequest(BaseModel):
    wordpress_site_id: Optional[uuid.UUID] = Field(
        None, description="Which published URL to use if the article is on multiple sites"
    )


class SocialPreviewResponse(BaseModel):
    article_url: str
    default_text: str
    instagram_text: str
    facebook_text: str
    linkedin_text: str
    x_text: str
    threads_text: str


class BlogWriterDashboardResponse(BaseModel):
    draft_count: int
    ready_count: int
    published_count: int
    failed_publications_count: int
    sites_count: int
    sites_error_count: int
    social_campaigns_count: int
    recent_articles: List[BlogArticleListItem]
    recent_publications: List[BlogPublicationResponse]
