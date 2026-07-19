from datetime import datetime, timezone, timedelta
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_admin
from app.models.administrator import Administrator
from app.models.buffer import BufferConnection, BufferOrganization, SocialChannel
from app.core.security import EncryptionService
from app.integrations.buffer.service import get_buffer_client
from app.tasks.sync import sync_buffer_connection
from app.schemas.schemas import (
    BufferConnectionResponse,
    BufferOrganizationResponse,
    SocialChannelResponse,
)

router = APIRouter()

@router.get("/connections", response_model=List[BufferConnectionResponse])
def list_connections(
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retrieve list of all connection instances."""
    return db.query(BufferConnection).all()


@router.get("/connections/oauth-url")
def get_oauth_url(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Generate state parameter and compile Buffer OAuth authorization URL."""
    # We check if user exists
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    client = get_buffer_client()
    auth_url = client.get_auth_url()
    
    # Append state to track which user_id is connecting
    # In production, we sign or state-cache this to prevent CSRF.
    # For Version 1, we pass the user_id plain in state.
    state_url = f"{auth_url}&state={user_id}"
    return {"url": state_url}


@router.get("/callback")
def oauth_callback(
    code: str,
    state: str, # this contains user_id
    db: Session = Depends(get_db)
):
    """
    Handle Buffer OAuth redirect callback.
    Exchanges authorization code, encrypts access/refresh tokens,
    creates connection database record, and queues initial synchronization.
    """
    try:
        user_id = uuid.UUID(state)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid state parameter (must be User ID)")
        
    client = get_buffer_client()
    try:
        tokens = client.exchange_code(code)
        
        # Check user info to get account ID
        access_token = tokens["access_token"]
        user_info = client.get_user_info(access_token)
        ext_account_id = user_info.get("id")
        
        # Check if connection already exists
        existing_conn = db.query(BufferConnection).filter(
            BufferConnection.user_id == user_id,
            BufferConnection.external_account_id == ext_account_id
        ).first()
        
        # Encrypt tokens
        enc_access = EncryptionService.encrypt(access_token)
        enc_refresh = EncryptionService.encrypt(tokens.get("refresh_token", ""))
        
        # Expiry time calculation
        expires_in = tokens.get("expires_in", 3600)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        
        if existing_conn:
            existing_conn.access_token_encrypted = enc_access
            existing_conn.refresh_token_encrypted = enc_refresh
            existing_conn.token_expires_at = expires_at
            existing_conn.scopes = tokens.get("scope")
            existing_conn.status = "connected"
            existing_conn.last_error = None
            connection = existing_conn
        else:
            connection = BufferConnection(
                user_id=user_id,
                authentication_type="oauth2",
                external_account_id=ext_account_id,
                access_token_encrypted=enc_access,
                refresh_token_encrypted=enc_refresh,
                token_expires_at=expires_at,
                scopes=tokens.get("scope"),
                status="connected",
            )
            db.add(connection)
        
        db.commit()
        db.refresh(connection)
        
        # Dispatch background sync task for organizations/channels
        sync_buffer_connection.delay(str(connection.id))
        
        # Redirect to Dashboard connected view
        # Redirect domain would be settings based in prod. E.g. app.example.com
        return RedirectResponse(url="http://localhost:3000/admin/connections?success=true")
        
    except Exception as e:
        # Redirect with error state
        return RedirectResponse(url=f"http://localhost:3000/admin/connections?error={str(e)}")


@router.post("/connections/{connection_id}/sync", status_code=status.HTTP_202_ACCEPTED)
def sync_connection(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Enqueues manual channels/organizations sync for a Buffer connection."""
    conn = db.query(BufferConnection).filter(BufferConnection.id == connection_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    sync_buffer_connection.delay(str(conn.id))
    return {"message": "Sync job dispatched to background worker"}


@router.get("/channels", response_model=List[SocialChannelResponse])
def list_channels(
    user_id: Optional[uuid.UUID] = None,
    platform: Optional[str] = None,
    publication_mode: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """List social channels with filters."""
    query = db.query(SocialChannel).join(
        BufferOrganization, SocialChannel.buffer_organization_id == BufferOrganization.id
    ).join(
        BufferConnection, BufferOrganization.buffer_connection_id == BufferConnection.id
    )
    
    if user_id:
        query = query.filter(BufferConnection.user_id == user_id)
    if platform:
        query = query.filter(SocialChannel.platform == platform.lower().strip())
    if publication_mode:
        query = query.filter(SocialChannel.publication_mode == publication_mode)
        
    return query.all()


@router.put("/channels/{channel_id}/publication-mode", response_model=SocialChannelResponse)
def update_channel_mode(
    channel_id: uuid.UUID,
    mode: str, # automatic, notification, approval, disabled
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Modify the publishing configuration mode of a social channel."""
    if mode not in ("automatic", "notification", "approval", "disabled"):
        raise HTTPException(status_code=400, detail="Invalid publication mode name.")
        
    channel = db.query(SocialChannel).filter(SocialChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
        
    channel.publication_mode = mode
    channel.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_connection(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Delete a Buffer connection, which cascade-deletes organizations and channels."""
    conn = db.query(BufferConnection).filter(BufferConnection.id == connection_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    db.delete(conn)
    db.commit()
    return
