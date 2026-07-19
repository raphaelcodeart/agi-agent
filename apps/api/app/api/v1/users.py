from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.api.v1.auth import get_current_admin
from app.models.administrator import Administrator
from app.models.user import User, UserGroup
from app.schemas.schemas import UserCreate, UserUpdate, UserResponse, GroupCreate, GroupResponse

router = APIRouter()

# ==============================================================================
# Users Endpoints
# ==============================================================================
@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """List and search clients / users."""
    query = db.query(User).filter(User.deleted_at.is_(None))
    
    if search:
        query = query.filter(
            or_(
                User.name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.company_name.ilike(f"%{search}%")
            )
        )
        
    if status_filter:
        query = query.filter(User.status == status_filter)
        
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Create a new client / user and optionally assign groups."""
    existing_user = db.query(User).filter(User.email == payload.email, User.deleted_at.is_(None)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists.")
        
    user = User(
        name=payload.name,
        email=payload.email,
        company_name=payload.company_name,
        status=payload.status,
        notes=payload.notes,
    )
    
    if payload.group_ids:
        groups = db.query(UserGroup).filter(UserGroup.id.in_(payload.group_ids)).all()
        user.groups = groups
        
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Retrieve details for a specific client."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Update a client's profile details or group assignments."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if payload.email and payload.email != user.email:
        existing = db.query(User).filter(User.email == payload.email, User.deleted_at.is_(None)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
            
    for k, v in payload.model_dump(exclude={"group_ids"}, exclude_unset=True).items():
        setattr(user, k, v)
        
    if payload.group_ids is not None:
        groups = db.query(UserGroup).filter(UserGroup.id.in_(payload.group_ids)).all()
        user.groups = groups
        
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Soft-delete a user."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return


# ==============================================================================
# Groups Endpoints
# ==============================================================================
@router.get("/groups/list", response_model=List[GroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """List all user groups."""
    return db.query(UserGroup).all()


@router.post("/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin)
):
    """Create a new targeting user group."""
    existing = db.query(UserGroup).filter(UserGroup.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group with this name already exists.")
        
    group = UserGroup(
        name=payload.name,
        description=payload.description
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group
