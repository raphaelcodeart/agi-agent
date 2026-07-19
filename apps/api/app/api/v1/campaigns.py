from datetime import datetime, timezone
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_admin
from app.models.administrator import Administrator
from app.models.campaign import Campaign, CampaignTarget
from app.models.publication import Publication
from app.models.media import MediaFile
from app.services.campaign_resolver import CampaignResolver
from app.schemas.schemas import (
    CampaignCreate,
    CampaignResponse,
    CampaignPreviewResponse,
    CampaignDetailResponse,
)

router = APIRouter()

@router.get("/", response_model=List[CampaignResponse])
def list_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retrieve lists of campaigns."""
    query = db.query(Campaign)
    if status_filter:
        query = query.filter(Campaign.status == status_filter)
    return query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Create a new campaign in draft status."""
    # Ensure media exists if specified
    if payload.media_file_id:
        media = db.query(MediaFile).filter(MediaFile.id == payload.media_file_id).first()
        if not media:
            raise HTTPException(status_code=404, detail="Media file not found")
            
    campaign = Campaign(
        title=payload.title,
        default_text=payload.default_text,
        instagram_text=payload.instagram_text,
        facebook_text=payload.facebook_text,
        linkedin_text=payload.linkedin_text,
        tiktok_text=payload.tiktok_text,
        youtube_title=payload.youtube_title,
        youtube_description=payload.youtube_description,
        x_text=payload.x_text,
        threads_text=payload.threads_text,
        media_file_id=payload.media_file_id,
        publishing_mode=payload.publishing_mode,
        scheduled_at=payload.scheduled_at,
        timezone=payload.timezone,
        targeting_mode=payload.targeting_mode,
        status="draft",
        created_by=admin.id,
        metadata_json=payload.targeting_params, # Save targeting parameters here
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/preview-targets", response_model=CampaignPreviewResponse)
def preview_targets(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """
    Simulates target resolution before launch, returning counts, 
    distribution, and warning exclusions.
    """
    # Create transient campaign model to run resolver
    campaign = Campaign(
        title=payload.title,
        default_text=payload.default_text,
        instagram_text=payload.instagram_text,
        facebook_text=payload.facebook_text,
        linkedin_text=payload.linkedin_text,
        tiktok_text=payload.tiktok_text,
        youtube_title=payload.youtube_title,
        youtube_description=payload.youtube_description,
        x_text=payload.x_text,
        threads_text=payload.threads_text,
        targeting_mode=payload.targeting_mode
    )
    
    preview = CampaignResolver.preview_campaign_targets(db, campaign, payload.targeting_params)
    return preview


@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
def launch_campaign(
    campaign_id: uuid.UUID,
    targeting_params: Dict[str, Any],
    channel_overrides: Optional[Dict[str, str]] = None,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """
    Launches a draft campaign. Resolves targets, creates Publications,
    and dispatches tasks to background workers.
    """
    try:
        campaign, publications = CampaignResolver.launch_campaign(
            db=db,
            campaign_id=campaign_id,
            targeting_params=targeting_params,
            admin_id=admin.id,
            channel_overrides=channel_overrides
        )
        
        # Enqueue enqueuing task or trigger immediately
        if campaign.publishing_mode == "immediate":
            # For immediate mode, we trigger the scheduled publication task immediately 
            # to queue and execute jobs
            from app.tasks.publication import poll_and_queue_scheduled_publications
            poll_and_queue_scheduled_publications.delay()
            
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{campaign_id}", response_model=CampaignDetailResponse)
def get_campaign_detail(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retrieve detailed stats and progress percentages for a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    publications = db.query(Publication).filter(Publication.campaign_id == campaign_id).all()
    
    stats = {
        "pending": 0, "queued": 0, "processing": 0, "submitted": 0,
        "scheduled": 0, "published": 0, "retry_wait": 0, "failed": 0,
        "cancelled": 0, "skipped": 0, "unknown": 0
    }
    
    for pub in publications:
        status_name = pub.status
        stats[status_name] = stats.get(status_name, 0) + 1
        
    # Calculate progress percentage
    total = len(publications)
    resolved = stats["published"] + stats["scheduled"] + stats["failed"] + stats["cancelled"] + stats["skipped"]
    progress = (resolved / total * 100.0) if total > 0 else 0.0
    
    # Get Media info
    media_res = None
    if campaign.media_file_id:
        media_res = db.query(MediaFile).filter(MediaFile.id == campaign.media_file_id).first()
        
    return {
        "campaign": campaign,
        "media": media_res,
        "stats": stats,
        "progress_percentage": round(progress, 2)
    }


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
def pause_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Pauses a running campaign. Moves all pending or queued jobs to retry_wait/paused state."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status != "running":
        raise HTTPException(status_code=400, detail="Only running campaigns can be paused")
        
    campaign.status = "paused"
    
    # Freeze pending publications
    db.query(Publication).filter(
        Publication.campaign_id == campaign_id,
        Publication.status.in_(["pending", "queued"])
    ).update({"status": "retry_wait", "next_attempt_at": datetime.now(timezone.utc) + timedelta(hours=24)}, synchronize_session=False)
    
    db.commit()
    return campaign


@router.post("/{campaign_id}/resume", response_model=CampaignResponse)
def resume_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Resume a paused campaign, shifting suspended jobs back to pending/queued status."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused campaigns can be resumed")
        
    campaign.status = "running"
    
    # Release frozen publications back to pending
    db.query(Publication).filter(
        Publication.campaign_id == campaign_id,
        Publication.status == "retry_wait"
    ).update({"status": "pending", "next_attempt_at": None}, synchronize_session=False)
    
    db.commit()
    
    # Trigger execution poll
    from app.tasks.publication import poll_and_queue_scheduled_publications
    poll_and_queue_scheduled_publications.delay()
    
    return campaign


@router.post("/{campaign_id}/cancel", response_model=CampaignResponse)
def cancel_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Cancels a campaign, moving all incomplete publications to cancelled state."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    campaign.status = "cancelled"
    campaign.completed_at = datetime.now(timezone.utc)
    
    # Cancel outstanding publications
    db.query(Publication).filter(
        Publication.campaign_id == campaign_id,
        Publication.status.in_(["pending", "queued", "retry_wait"])
    ).update({"status": "cancelled"}, synchronize_session=False)
    
    db.commit()
    return campaign
