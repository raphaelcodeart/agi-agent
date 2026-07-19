import abc
from datetime import datetime
from typing import Dict, Any, List, Optional

class BaseBufferClient(abc.ABC):
    @abc.abstractmethod
    def get_auth_url(self) -> str:
        """Generate the OAuth authorization URL."""
        pass

    @abc.abstractmethod
    def exchange_code(self, code: str) -> Dict[str, Any]:
        """Exchange the auth code for an access token and refresh token."""
        pass

    @abc.abstractmethod
    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh an expired access token."""
        pass

    @abc.abstractmethod
    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Fetch basic profile data for the authenticated user."""
        pass

    @abc.abstractmethod
    def sync_organizations(self, access_token: str) -> List[Dict[str, Any]]:
        """Fetch organizations belonging to the Buffer connection."""
        pass

    @abc.abstractmethod
    def sync_channels(self, access_token: str, organization_id: str) -> List[Dict[str, Any]]:
        """Fetch channels (profiles) available under a specific organization."""
        pass

    @abc.abstractmethod
    def create_post(
        self,
        access_token: str,
        channel_id: str,
        text: str,
        media_url: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        media_type: Optional[str] = None, # "image" or "video"
        scheduled_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Create a post (immediate or scheduled)."""
        pass

    @abc.abstractmethod
    def get_post_status(self, access_token: str, external_post_id: str) -> Dict[str, Any]:
        """Check the status of a specific post on Buffer."""
        pass
