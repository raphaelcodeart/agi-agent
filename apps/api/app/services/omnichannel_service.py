"""
Business logic for message ingestion, customer/conversation resolution and
supporting CRM records (notes, tags, notifications, audit log) for the
Omnichannel Responder module. Draft/approval workflow lives in
omnichannel_draft_service.py - kept separate because it has its own
concurrency/idempotency concerns (see that file's docstring).
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.security import EncryptionService
from app.integrations.omnichannel.connectors.base import NormalizedIncomingMessage
from app.models.omnichannel import (
    OmniAIAgentConfig,
    OmniAuditLog,
    OmniChannelAccount,
    OmniConversation,
    OmniCustomer,
    OmniCustomerIdentity,
    OmniInternalNote,
    OmniMessage,
    OmniNotification,
)
from app.schemas.schemas import OmniChannelAccountCreate

# Conversation statuses that should be reopened (not appended to silently) when
# a new inbound message arrives.
_TERMINAL_STATUSES = {"RESOLVED", "ARCHIVED"}


class OmnichannelService:
    @staticmethod
    def get_or_create_ai_agent_config(db: Session, owner_id: uuid.UUID) -> OmniAIAgentConfig:
        config = db.query(OmniAIAgentConfig).filter(OmniAIAgentConfig.owner_id == owner_id).first()
        if config:
            return config
        config = OmniAIAgentConfig(owner_id=owner_id)
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def create_channel_account(db: Session, owner_id: uuid.UUID, payload: OmniChannelAccountCreate) -> OmniChannelAccount:
        account = OmniChannelAccount(
            owner_id=owner_id,
            channel=payload.channel,
            name=payload.name,
            external_account_id=payload.external_account_id,
            access_token_encrypted=EncryptionService.encrypt(payload.access_token) if payload.access_token else None,
            config_json=payload.config,
            status="pending",
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def _find_or_create_customer(db: Session, owner_id: uuid.UUID, channel: str, external_user_id: str, display_name: Optional[str]) -> OmniCustomer:
        identity = (
            db.query(OmniCustomerIdentity)
            .filter(
                OmniCustomerIdentity.owner_id == owner_id,
                OmniCustomerIdentity.channel == channel,
                OmniCustomerIdentity.external_user_id == external_user_id,
            )
            .first()
        )
        if identity:
            return identity.customer

        customer = OmniCustomer(owner_id=owner_id, name=display_name)
        db.add(customer)
        db.flush()  # assign customer.id before the identity FK needs it

        identity = OmniCustomerIdentity(
            owner_id=owner_id,
            customer_id=customer.id,
            channel=channel,
            external_user_id=external_user_id,
            display_name=display_name,
        )
        db.add(identity)
        return customer

    @staticmethod
    def _find_or_create_conversation(db: Session, owner_id: uuid.UUID, channel_account: OmniChannelAccount, customer: OmniCustomer) -> OmniConversation:
        conversation = (
            db.query(OmniConversation)
            .filter(
                OmniConversation.owner_id == owner_id,
                OmniConversation.channel_account_id == channel_account.id,
                OmniConversation.customer_id == customer.id,
            )
            .order_by(OmniConversation.created_at.desc())
            .first()
        )
        if conversation and conversation.status not in _TERMINAL_STATUSES:
            return conversation

        conversation = OmniConversation(
            owner_id=owner_id,
            channel_account_id=channel_account.id,
            customer_id=customer.id,
            status="NEW",
        )
        db.add(conversation)
        db.flush()
        return conversation

    @staticmethod
    def ingest_message(db: Session, channel_account: OmniChannelAccount, normalized: NormalizedIncomingMessage) -> Optional[OmniMessage]:
        """
        Normalizes an inbound webhook event into customer/conversation/message
        rows. Returns None (no-op) if external_message_id was already ingested
        for this channel account - webhook idempotency per spec section 29,
        enforced here AND by the DB unique constraint as a hard backstop.
        """
        owner_id = channel_account.owner_id

        if normalized.external_message_id:
            existing = (
                db.query(OmniMessage)
                .filter(
                    OmniMessage.channel_account_id == channel_account.id,
                    OmniMessage.external_message_id == normalized.external_message_id,
                )
                .first()
            )
            if existing:
                return None

        customer = OmnichannelService._find_or_create_customer(
            db, owner_id, channel_account.channel, normalized.external_user_id, normalized.customer_display_name
        )
        conversation = OmnichannelService._find_or_create_conversation(db, owner_id, channel_account, customer)

        message = OmniMessage(
            owner_id=owner_id,
            conversation_id=conversation.id,
            channel_account_id=channel_account.id,
            direction="inbound",
            sender_type="customer",
            external_message_id=normalized.external_message_id,
            text=normalized.text,
            message_type=normalized.message_type,
            attachments_json=normalized.attachments or None,
            metadata_json=normalized.metadata or None,
            status="received",
        )
        db.add(message)

        now = datetime.now(timezone.utc)
        conversation.last_message_at = now
        conversation.unread_count = (conversation.unread_count or 0) + 1
        conversation.status = "AI_PROCESSING"
        customer.last_contact_at = now
        if normalized.customer_display_name and not customer.name:
            customer.name = normalized.customer_display_name

        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def add_internal_note(db: Session, conversation: OmniConversation, admin_id: uuid.UUID, text: str, mentions: Optional[List[str]]) -> OmniInternalNote:
        note = OmniInternalNote(
            owner_id=conversation.owner_id,
            conversation_id=conversation.id,
            admin_id=admin_id,
            text=text,
            mentions_json=mentions,
        )
        db.add(note)
        for mention in mentions or []:
            OmnichannelService.create_notification(
                db, conversation.owner_id, None, "mention",
                f"Sei stato menzionato in una conversazione", text[:200],
                "conversation", conversation.id,
            )
        db.commit()
        db.refresh(note)
        return note

    @staticmethod
    def create_notification(
        db: Session, owner_id: uuid.UUID, admin_id: Optional[uuid.UUID], type_: str,
        title: str, body: Optional[str], entity_type: Optional[str], entity_id: Optional[uuid.UUID],
    ) -> OmniNotification:
        notification = OmniNotification(
            owner_id=owner_id, admin_id=admin_id, type=type_, title=title, body=body,
            entity_type=entity_type, entity_id=entity_id,
        )
        db.add(notification)
        return notification

    @staticmethod
    def log_audit(
        db: Session, owner_id: uuid.UUID, admin_id: Optional[uuid.UUID], action: str,
        entity_type: str, entity_id: Optional[uuid.UUID], metadata: Optional[Dict[str, Any]] = None,
    ) -> OmniAuditLog:
        audit = OmniAuditLog(owner_id=owner_id, admin_id=admin_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_json=metadata)
        db.add(audit)
        return audit
