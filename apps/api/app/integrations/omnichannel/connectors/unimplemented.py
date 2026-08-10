"""
Placeholder connectors for channels not yet wired to a real, official API in
this first version (WhatsApp Business Cloud API, Instagram/Facebook
Messenger via the Meta Graph API - all require app review/business
verification that can't be completed from inside this codebase). Kept as
real classes registered in the connector registry, per spec section 4/36,
so wiring up the real implementation later is a one-file change with no
changes anywhere else in the module - never invents endpoints, just refuses
clearly until the real integration is implemented.
"""
from typing import Any, Dict, List
from app.integrations.omnichannel.connectors.base import Connector, NormalizedIncomingMessage, SendResult
from app.integrations.omnichannel.exceptions import ConnectorError


class _NotYetImplementedConnector(Connector):
    channel_label = "questo canale"

    def verify_webhook(self, headers: Dict[str, str], path_secret: str) -> bool:
        return False

    def parse_webhook(self, payload: Dict[str, Any]) -> List[NormalizedIncomingMessage]:
        return []

    def send_message(self, external_user_id: str, text: str) -> SendResult:
        raise ConnectorError(f"Il connettore per {self.channel_label} non è ancora implementato in questa versione.")

    def get_status(self) -> Dict[str, Any]:
        return {"status": "not_implemented", "detail": f"Connettore {self.channel_label} non ancora disponibile"}


class WhatsAppConnector(_NotYetImplementedConnector):
    channel_label = "WhatsApp Business"


class InstagramConnector(_NotYetImplementedConnector):
    channel_label = "Instagram Direct"


class FacebookConnector(_NotYetImplementedConnector):
    channel_label = "Facebook Messenger"
