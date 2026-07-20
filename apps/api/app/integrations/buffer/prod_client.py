from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx
from app.integrations.buffer.client import BaseBufferClient
from app.integrations.buffer.exceptions import (
    BufferApiError,
    BufferAuthError,
    BufferRateLimitError,
    BufferServerError,
    BufferNetworkError,
)

class ProductionBufferClient(BaseBufferClient):
    """
    Production client for Buffer's GraphQL API (https://api.buffer.com).
    Documentation reference: https://developers.buffer.com/
    Auth: single personal API key per account, sent as `Authorization: Bearer <key>`
    (verified against developers.buffer.com/guides/authentication.html, July 2026).
    """

    BASE_URL = "https://api.buffer.com"

    def _request(self, api_key: str, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {"query": query, "variables": variables or {}}

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(self.BASE_URL, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise BufferNetworkError(f"HTTP communication failure: {str(exc)}")

        if response.status_code == 401:
            raise BufferAuthError("Invalid or revoked Buffer API key", status_code=401)
        elif response.status_code == 429:
            raise BufferRateLimitError("Buffer API rate limit exceeded", status_code=429)
        elif response.status_code >= 500:
            raise BufferServerError(f"Buffer API server error: {response.text}", status_code=response.status_code)
        elif response.status_code >= 400:
            raise BufferApiError(
                message=f"Buffer API request failed: {response.text}",
                status_code=response.status_code,
                category="bad_request",
            )

        body = response.json()
        errors = body.get("errors")
        if errors:
            message = "; ".join(e.get("message", "Unknown GraphQL error") for e in errors)
            raise BufferApiError(message=message, status_code=response.status_code, category="graphql_error")

        return body.get("data", {})

    def _run_mutation(self, api_key: str, query: str, variables: Dict[str, Any], field_name: str) -> Dict[str, Any]:
        """Runs a mutation returning a union type (e.g. PostActionSuccess | MutationError) and unwraps it."""
        data = self._request(api_key, query, variables)
        result = data.get(field_name) or {}
        if "message" in result and "post" not in result:
            # Shape matches the MutationError branch of the response union.
            raise BufferApiError(message=result["message"], category="validation_failed")
        return result

    def get_user_info(self, api_key: str) -> Dict[str, Any]:
        query = """
        query GetAccount {
          account {
            id
            email
            name
          }
        }
        """
        data = self._request(api_key, query)
        account = data.get("account") or {}
        return {
            "id": account.get("id"),
            "name": account.get("name"),
            "email": account.get("email"),
        }

    def sync_organizations(self, api_key: str) -> List[Dict[str, Any]]:
        query = """
        query GetOrganizations {
          account {
            organizations {
              id
              name
            }
          }
        }
        """
        data = self._request(api_key, query)
        organizations = (data.get("account") or {}).get("organizations") or []
        return [
            {"id": org.get("id"), "name": org.get("name"), "is_active": True}
            for org in organizations
        ]

    def sync_channels(self, api_key: str, organization_id: str) -> List[Dict[str, Any]]:
        query = """
        query GetChannels($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) {
            id
            service
            name
            avatar
            descriptor
            isDisconnected
            type
          }
        }
        """
        data = self._request(api_key, query, {"organizationId": organization_id})
        channels = data.get("channels") or []
        return [
            {
                "id": chan.get("id"),
                "platform": str(chan.get("service", "unknown")).lower(),
                "name": chan.get("descriptor") or chan.get("name", "Unknown"),
                "username": chan.get("name"),
                "avatar_url": chan.get("avatar"),
                "channel_type": chan.get("type"),
                "is_active": not chan.get("isDisconnected", False),
            }
            for chan in channels
        ]

    def create_post(
        self,
        api_key: str,
        channel_id: str,
        text: str,
        media_url: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        media_type: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        platform: Optional[str] = None,
        youtube_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        post_input: Dict[str, Any] = {
            "channelId": channel_id,
            "text": text,
        }

        if platform == "youtube":
            # YoutubePostMetadataInput.title and .categoryId are both required on
            # create (see developers.buffer.com/types/YoutubePostMetadataInput.html).
            # categoryId is a string form of YouTube's own numeric category taxonomy
            # (1-29); the platform has no per-campaign category setting yet, so this
            # defaults to "22" (People & Blogs), YouTube's own catch-all default for
            # uncategorized uploads - not a Buffer-specific value.
            post_input["metadata"] = {
                "youtube": {
                    "title": youtube_title or text[:100],
                    "categoryId": "22",
                }
            }

        if scheduled_at:
            post_input["schedulingType"] = "automatic"
            post_input["mode"] = "customScheduled"
            post_input["dueAt"] = scheduled_at.isoformat()
        else:
            # Adds the post to the channel's next available queue slot, i.e. the
            # user's Buffer posting schedule ("palinsesto") - this is the default
            # and desired behavior for this platform.
            post_input["schedulingType"] = "automatic"
            post_input["mode"] = "addToQueue"

        if media_url:
            if media_type == "video":
                # thumbnail_url is intentionally not sent here: Buffer's real schema
                # (VideoAssetInput.thumbnailUrl, see developers.buffer.com/reference.html)
                # documents that field as rejected by the API - social networks don't
                # accept custom video thumbnail images. The only supported thumbnail
                # control is metadata.thumbnailOffset (a frame offset within the video
                # itself, in ms, and only honored by Instagram/TikTok/Pinterest), which
                # isn't equivalent to our server-generated thumbnail image and isn't
                # implemented here.
                post_input["assets"] = [{"video": {"url": media_url}}]
            else:
                post_input["assets"] = [{"image": {"url": media_url}}]

        query = """
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            ... on PostActionSuccess {
              post {
                id
                dueAt
              }
            }
            ... on MutationError {
              message
            }
          }
        }
        """
        result = self._run_mutation(api_key, query, {"input": post_input}, "createPost")
        post = result.get("post") or result

        is_scheduled = scheduled_at is not None
        return {
            "id": post.get("id"),
            "status": "scheduled" if is_scheduled else "queued",
            "channel_id": channel_id,
            "text": text,
            "media_url": media_url,
            "scheduled_at": post.get("dueAt"),
            "published_at": None,
            "url": None,
        }

    def get_post_status(self, api_key: str, external_post_id: str) -> Dict[str, Any]:
        # BUFFER_API_TODO: Not verified against developers.buffer.com - reconciliation
        # of a single post's status isn't in this platform's active publication path
        # yet. Implement once needed, using the documented posts/pagination queries
        # (see https://developers.buffer.com/examples/get-posts-for-channels.html)
        # instead of guessing a field name.
        raise NotImplementedError(
            "get_post_status is not yet implemented for the Buffer GraphQL API client"
        )
