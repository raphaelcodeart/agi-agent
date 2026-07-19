import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.campaign import Campaign, CampaignTarget
from app.models.user import User, UserGroup
from app.models.buffer import BufferConnection, BufferOrganization, SocialChannel
from app.models.publication import Publication
from app.models.audit import AuditLog

class CampaignResolver:
    @staticmethod
    def resolve_targets(db: Session, campaign: Campaign, targeting_params: Dict[str, Any]) -> List[SocialChannel]:
        """
        Resolves the target social channels based on the campaign's targeting mode
        and criteria parameters.
        
        targeting_params may contain:
        - user_ids: List[str]
        - group_ids: List[str]
        - platform_names: List[str]
        - channel_ids: List[str]
        """
        mode = campaign.targeting_mode
        
        # Base query to fetch active channels with active connections & users
        query = db.query(SocialChannel).join(
            BufferOrganization, SocialChannel.buffer_organization_id == BufferOrganization.id
        ).join(
            BufferConnection, BufferOrganization.buffer_connection_id == BufferConnection.id
        ).join(
            User, BufferConnection.user_id == User.id
        )

        # Apply general status exclusions
        query = query.filter(
            User.status == "active",
            User.deleted_at.is_(None),
            BufferConnection.status == "connected",
            SocialChannel.is_active.is_(True),
            SocialChannel.publication_mode != "disabled"
        )

        if mode == "all_active_channels":
            return query.all()
            
        elif mode == "selected_users":
            user_ids = [uuid.UUID(uid) for uid in targeting_params.get("user_ids", [])]
            if not user_ids:
                return []
            return query.filter(User.id.in_(user_ids)).all()
            
        elif mode == "selected_groups":
            group_ids = [uuid.UUID(gid) for gid in targeting_params.get("group_ids", [])]
            if not group_ids:
                return []
            return query.filter(User.groups.any(UserGroup.id.in_(group_ids))).all()
            
        elif mode == "selected_channels":
            channel_ids = [uuid.UUID(cid) for cid in targeting_params.get("channel_ids", [])]
            if not channel_ids:
                return []
            return query.filter(SocialChannel.id.in_(channel_ids)).all()
            
        elif mode == "selected_platforms":
            platforms = [p.lower().strip() for p in targeting_params.get("platform_names", [])]
            if not platforms:
                return []
            return query.filter(SocialChannel.platform.in_(platforms)).all()
            
        return []

    @staticmethod
    def resolve_text_for_channel(campaign: Campaign, channel: SocialChannel, channel_override_text: str = None) -> str:
        """
        Text resolution order of priority:
        1. Channel-specific text override
        2. Platform-specific campaign text
        3. Default campaign text
        """
        if channel_override_text:
            return channel_override_text

        platform = channel.platform.lower().strip()
        if platform == "instagram" and campaign.instagram_text:
            return campaign.instagram_text
        elif platform == "facebook" and campaign.facebook_text:
            return campaign.facebook_text
        elif platform == "linkedin" and campaign.linkedin_text:
            return campaign.linkedin_text
        elif platform == "tiktok" and campaign.tiktok_text:
            return campaign.tiktok_text
        elif platform == "x" and campaign.x_text:
            return campaign.x_text
        elif platform == "threads" and campaign.threads_text:
            return campaign.threads_text
        
        # Youtube title/desc handled separately or parsed as default
        if platform == "youtube":
            title = campaign.youtube_title or campaign.title
            desc = campaign.youtube_description or campaign.default_text
            return f"TITLE: {title}\n\nDESCRIPTION:\n{desc}"

        return campaign.default_text

    @classmethod
    def preview_campaign_targets(
        cls, db: Session, campaign: Campaign, targeting_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates target details for preview before launching a campaign.
        """
        channels = cls.resolve_targets(db, campaign, targeting_params)
        
        # Excluded counts logic (simulate what gets filtered out)
        # Fetch total targets in database to compare
        total_active_users = db.query(User).filter(User.status == "active", User.deleted_at.is_(None)).count()
        total_channels = db.query(SocialChannel).filter(SocialChannel.is_active.is_(True)).count()
        
        platform_distribution = {}
        users_set = set()
        notification_approval_count = 0

        for chan in channels:
            platform_distribution[chan.platform] = platform_distribution.get(chan.platform, 0) + 1
            # Retrieve connection owner
            conn = chan.buffer_organization.buffer_connection
            users_set.add(conn.user_id)
            if chan.publication_mode in ("notification", "approval"):
                notification_approval_count += 1

        # Build list of excluded channels for visual warning
        # An user or connection might be disconnected or suspended
        excluded_channels_count = total_channels - len(channels)

        return {
            "estimated_publications_count": len(channels),
            "total_users_targeted": len(users_set),
            "platform_distribution": platform_distribution,
            "channels_requiring_notification_approval": notification_approval_count,
            "excluded_channels_count": max(0, excluded_channels_count),
            "total_active_users": total_active_users,
        }

    @classmethod
    def launch_campaign(
        cls, 
        db: Session, 
        campaign_id: uuid.UUID, 
        targeting_params: Dict[str, Any],
        admin_id: Optional[uuid.UUID] = None,
        channel_overrides: Optional[Dict[str, str]] = None # maps channel_id -> custom_text
    ) -> Tuple[Campaign, List[Publication]]:
        """
        Launches a campaign: resolves targets, creates CampaignTargets & Publications,
        commits atomic transaction, and logs audit record.
        """
        if channel_overrides is None:
            channel_overrides = {}

        # 1. Fetch Campaign
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign with ID {campaign_id} not found.")

        if campaign.status not in ("draft", "failed", "paused"):
            raise ValueError(f"Campaign is in status {campaign.status} and cannot be launched.")

        campaign.status = "preparing"
        db.flush()

        # 2. Resolve target channels
        channels = cls.resolve_targets(db, campaign, targeting_params)
        if not channels:
            campaign.status = "failed"
            db.commit()
            raise ValueError("No valid social channels targetable for the selected parameters.")

        publications_created = []

        # 3. Create CampaignTargets & Publications
        # We wrap in sub-transactions/flushes for atomicity
        for chan in channels:
            conn = chan.buffer_organization.buffer_connection
            user_id = conn.user_id
            
            # Resolve text
            override_text = channel_overrides.get(str(chan.id))
            resolved_text = cls.resolve_text_for_channel(campaign, chan, override_text)
            
            # Check unique constraint to avoid duplicating targets on retry launch
            existing_target = db.query(CampaignTarget).filter(
                CampaignTarget.campaign_id == campaign.id,
                CampaignTarget.social_channel_id == chan.id
            ).first()
            
            if existing_target:
                target = existing_target
                target.resolved_text = resolved_text
                target.status = "created"
            else:
                target = CampaignTarget(
                    campaign_id=campaign.id,
                    user_id=user_id,
                    social_channel_id=chan.id,
                    resolved_text=resolved_text,
                    status="created"
                )
                db.add(target)
            db.flush() # get target ID
            
            # Deterministic idempotency key: campaign_id:channel_id
            idempotency_key = f"{campaign.id}:{chan.id}"
            
            existing_pub = db.query(Publication).filter(
                Publication.idempotency_key == idempotency_key
            ).first()
            
            # Determine initial status
            initial_pub_status = "pending"
            # If campaign scheduled for future
            scheduled_time = None
            if campaign.publishing_mode == "scheduled":
                scheduled_time = campaign.scheduled_at
                initial_pub_status = "pending" # will be picked up by scheduler when time matches
            elif campaign.publishing_mode == "immediate":
                initial_pub_status = "pending" # ready to process immediately
            elif campaign.publishing_mode == "buffer_queue":
                initial_pub_status = "pending" # will queue on buffer
                
            if not existing_pub:
                publication = Publication(
                    campaign_id=campaign.id,
                    campaign_target_id=target.id,
                    user_id=user_id,
                    social_channel_id=chan.id,
                    buffer_connection_id=conn.id,
                    external_channel_id=chan.external_channel_id,
                    status=initial_pub_status,
                    attempt_count=0,
                    max_attempts=settings.MAX_PUBLICATION_ATTEMPTS,
                    idempotency_key=idempotency_key,
                    scheduled_at=scheduled_time,
                )
                db.add(publication)
                publications_created.append(publication)
            else:
                # If publication already failed or retry-wait, we reset it to pending
                if existing_pub.status in ("failed", "cancelled", "retry_wait"):
                    existing_pub.status = initial_pub_status
                    existing_pub.attempt_count = 0
                    existing_pub.error_message = None
                    existing_pub.error_code = None
                    existing_pub.error_category = None
                    publications_created.append(existing_pub)

        # 4. Update Campaign Status
        campaign.status = "queued"
        campaign.started_at = datetime.now(timezone.utc)
        
        # Create audit log
        audit = AuditLog(
            administrator_id=admin_id,
            action="campaign_launch",
            entity_type="campaign",
            entity_id=campaign.id,
            metadata_json={
                "targeted_channels_count": len(channels),
                "publishing_mode": campaign.publishing_mode,
            }
        )
        db.add(audit)
        
        # Commit transaction atomically
        db.commit()
        
        return campaign, publications_created
