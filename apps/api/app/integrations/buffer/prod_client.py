import urllib.parse
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings
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
    Production client for the Buffer Publish API (v1).
    Documentation Reference: https://buffer.com/developers/api
    """
    def __init__(self):
        self.base_url = "https://api.bufferapp.com/1"
        self.client_id = settings.BUFFER_CLIENT_ID
        self.client_secret = settings.BUFFER_CLIENT_SECRET
        self.redirect_uri = settings.BUFFER_REDIRECT_URI

    def _request(
        self,
        method: str,
        path: str,
        token: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                )
                
                # Check status
                if response.status_code == 401:
                    raise BufferAuthError("Unauthorized access to Buffer API", status_code=401)
                elif response.status_code == 429:
                    raise BufferRateLimitError("Buffer API Rate limit exceeded", status_code=429)
                elif response.status_code >= 500:
                    raise BufferServerError(f"Buffer API server error: {response.text}", status_code=response.status_code)
                elif response.status_code >= 400:
                    raise BufferApiError(
                        message=f"Buffer API request failed: {response.text}",
                        status_code=response.status_code,
                        category="bad_request"
                    )
                
                return response.json()
        except httpx.RequestError as exc:
            raise BufferNetworkError(f"HTTP communication failure: {str(exc)}")

    def get_auth_url(self) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
        }
        return f"https://bufferapp.com/oauth2/authorize?{urllib.parse.urlencode(params)}"

    def exchange_code(self, code: str) -> Dict[str, Any]:
        # BUFFER_API_TODO: Verify parameters for production token exchange
        url = "https://api.bufferapp.com/1/oauth2/token.json"
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "code": code,
            "grant_type": "authorization_code",
        }
        try:
            with httpx.Client() as client:
                res = client.post(url, data=data, timeout=10.0)
                if res.status_code != 200:
                    raise BufferAuthError(f"OAuth code exchange failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as exc:
            raise BufferNetworkError(f"OAuth token exchange communication failed: {str(exc)}")

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        # BUFFER_API_TODO: Verify if standard oauth2/token refresh endpoint applies
        url = "https://api.bufferapp.com/1/oauth2/token.json"
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        try:
            with httpx.Client() as client:
                res = client.post(url, data=data, timeout=10.0)
                if res.status_code != 200:
                    raise BufferAuthError(f"OAuth token refresh failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as exc:
            raise BufferNetworkError(f"OAuth token refresh communication failed: {str(exc)}")

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        # Get authenticated user info
        return self._request("GET", "user.json", token=access_token)

    def sync_organizations(self, access_token: str) -> List[Dict[str, Any]]:
        # BUFFER_API_TODO: Map organizations retrieve.
        # Note: If Buffer v1 API only lists user accounts, we might mock organization groupings.
        # This implementation expects standard user.json profiles.
        res = self._request("GET", "profiles.json", token=access_token)
        # Parse organizations from profile metadata if applicable, or group in one default organization
        # We return a synthetic list containing a default organization mapping to user details
        user_info = self.get_user_info(access_token)
        user_name = user_info.get("name", "Buffer Organization")
        return [
            {
                "id": f"org_{user_info.get('id', 'default')}",
                "name": f"{user_name}'s Workspace",
                "is_active": True,
            }
        ]

    def sync_channels(self, access_token: str, organization_id: str) -> List[Dict[str, Any]]:
        # Get profiles from Buffer API
        profiles = self._request("GET", "profiles.json", token=access_token)
        
        channels = []
        for profile in profiles:
            channels.append({
                "id": profile.get("id"),
                "platform": profile.get("service", "unknown").lower(),
                "name": profile.get("formatted_username", profile.get("service_username", "Unknown")),
                "username": profile.get("service_username"),
                "avatar_url": profile.get("avatar"),
                "channel_type": profile.get("service_type"),
            })
        return channels

    def create_post(
        self,
        access_token: str,
        channel_id: str,
        text: str,
        media_url: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        media_type: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        # BUFFER_API_TODO: Align with real Buffer POST request payload
        # POST /1/updates/create.json
        payload = {
            "text": text,
            "profile_ids[]": [channel_id],
            "shorten": False,
        }

        # Handle scheduling parameters
        if scheduled_at:
            payload["scheduled_at"] = scheduled_at.isoformat()
            # If buffer queue is chosen, the api has a "top" or "now" or custom parameter.
        
        # Attach media if available
        if media_url:
            media = {"link": media_url}
            if media_type == "image":
                media["photo"] = media_url
            elif media_type == "video":
                media["video"] = media_url
                if thumbnail_url:
                    media["thumbnail"] = thumbnail_url
            payload["media"] = media

        res = self._request("POST", "updates/create.json", token=access_token, json_data=payload)
        
        # Buffer API returns updates array: {"updates": [ { "id": "...", "status": "..." } ] }
        updates = res.get("updates", [])
        if not updates:
            raise BufferApiError("Buffer returned success status, but no update payload was found.")
            
        update = updates[0]
        return {
            "id": update.get("id"),
            "status": update.get("status", "published"),
            "channel_id": channel_id,
            "text": text,
            "media_url": media_url,
            "scheduled_at": update.get("scheduled_at"),
            "published_at": update.get("sent_at"),
            "url": f"https://publish.buffer.com/updates/{update.get('id')}",
        }

    def get_post_status(self, access_token: str, external_post_id: str) -> Dict[str, Any]:
        # GET /1/updates/<id>.json
        res = self._request("GET", f"updates/{external_post_id}.json", token=access_token)
        return {
            "id": res.get("id"),
            "status": res.get("status"),
            "published_at": res.get("sent_at"),
            "url": f"https://publish.buffer.com/updates/{res.get('id')}",
        }
DefinitionName = "ProductionBufferClient"
