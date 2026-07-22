import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_admin
from app.models.administrator import Administrator
from app.models.publication import Publication, PublicationAttempt
from app.models.user import User
from app.models.buffer import SocialChannel
from app.tasks.publication import process_publication_task
from app.schemas.schemas import (
    PublicationResponse,
    PublicationDetailResponse,
    PublicationAttemptResponse,
)

router = APIRouter()

@router.get("/", response_model=List[PublicationResponse])
def list_publications(
    campaign_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retrieve lists of publications, optionally filtered by campaign or status."""
    query = db.query(Publication)
    if campaign_id:
        query = query.filter(Publication.campaign_id == campaign_id)
    if status_filter:
        query = query.filter(Publication.status == status_filter)
        
    return query.offset(skip).limit(limit).all()


@router.get("/{pub_id}", response_model=PublicationDetailResponse)
def get_publication(
    pub_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retrieve detailed publication status, resolving target texts and attempt logs."""
    pub = db.query(Publication).filter(Publication.id == pub_id).first()
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found")
        
    # Query attempts
    attempts = db.query(PublicationAttempt).filter(
        PublicationAttempt.publication_id == pub_id
    ).order_by(PublicationAttempt.attempt_number.asc()).all()
    
    return {
        "publication": pub,
        "attempts": attempts,
        "resolved_text": pub.campaign_target.resolved_text,
        "channel_name": pub.social_channel.name,
        "channel_platform": pub.social_channel.platform,
        "user_name": pub.user.name,
    }


@router.post("/{pub_id}/retry", response_model=PublicationResponse)
def retry_publication(
    pub_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retries a specific failed, cancelled, retry_wait, or stuck queued publication."""
    pub = db.query(Publication).filter(Publication.id == pub_id).first()
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found")

    # "queued" is included so an admin can manually unstick a publication whose
    # background job was lost (its own automatic recovery only kicks in after 15
    # minutes, see tasks/cleanup.py recover_stale_publications) without waiting.
    if pub.status not in ("failed", "cancelled", "retry_wait", "queued"):
        raise HTTPException(status_code=400, detail="Only failed, cancelled, retry_wait, or stuck queued publications can be manually retried.")
        
    # Reset status
    pub.status = "pending"
    pub.next_attempt_at = None
    pub.error_message = None
    pub.error_code = None
    pub.error_category = None
    
    # Increase attempt limit if already exhausted
    if pub.attempt_count >= pub.max_attempts:
        pub.max_attempts += 3 # extend limit
        
    db.commit()
    db.refresh(pub)
    
    # Trigger task
    process_publication_task.delay(str(pub.id))
    return pub


@router.post("/retry-selected")
def retry_selected_publications(
    pub_ids: List[uuid.UUID],
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Bulk retries a list of selected publications."""
    pubs = db.query(Publication).filter(
        Publication.id.in_(pub_ids),
        Publication.status.in_(["failed", "cancelled", "retry_wait", "queued"])
    ).all()
    
    for pub in pubs:
        pub.status = "pending"
        pub.next_attempt_at = None
        pub.error_message = None
        pub.error_code = None
        pub.error_category = None
        if pub.attempt_count >= pub.max_attempts:
            pub.max_attempts += 3
            
    db.commit()
    
    # Dispatch tasks
    for pub in pubs:
        process_publication_task.delay(str(pub.id))
        
    return {"message": f"Successfully queued {len(pubs)} publications for retry."}


@router.post("/retry-campaign-failures/{campaign_id}")
def retry_campaign_failures(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retries all failed publications for a campaign."""
    pubs = db.query(Publication).filter(
        Publication.campaign_id == campaign_id,
        Publication.status == "failed"
    ).all()
    
    if not pubs:
        return {"message": "No failed publications found for this campaign."}
        
    for pub in pubs:
        pub.status = "pending"
        pub.next_attempt_at = None
        pub.error_message = None
        pub.error_code = None
        pub.error_category = None
        if pub.attempt_count >= pub.max_attempts:
            pub.max_attempts += 3
            
    db.commit()
    
    # Dispatch tasks
    for pub in pubs:
        process_publication_task.delay(str(pub.id))
        
    # Reset campaign status to running
    from app.models.campaign import Campaign
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign:
        campaign.status = "running"
        db.commit()
        
    return {"message": f"Queued {len(pubs)} failed publications for retry."}


@router.post("/{pub_id}/cancel", response_model=PublicationResponse)
def cancel_publication(
    pub_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Cancel a pending, queued or retry_wait publication job."""
    pub = db.query(Publication).filter(Publication.id == pub_id).first()
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found")
        
    if pub.status not in ("pending", "queued", "retry_wait"):
        raise HTTPException(status_code=400, detail="Cannot cancel a job that is already complete or active.")
        
    pub.status = "cancelled"
    db.commit()
    db.refresh(pub)
    return pub


@router.post("/{pub_id}/skip", response_model=PublicationResponse)
def skip_publication(
    pub_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Mark a publication job as skipped (will not be published or retried)."""
    pub = db.query(Publication).filter(Publication.id == pub_id).first()
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found")
        
    if pub.status not in ("pending", "queued", "retry_wait", "failed"):
        raise HTTPException(status_code=400, detail="Cannot skip an already processed job.")
        
    pub.status = "skipped"
    db.commit()
    db.refresh(pub)
    return pub
