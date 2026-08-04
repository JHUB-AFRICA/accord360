"""User use-cases shared by the HTTP adapter and future adapters."""

from __future__ import annotations

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from ...deps import audit
from .models import User
from .schemas import LoginRequest, UserCreate, UserUpdate

__all__ = [
    "hash_password",
    "authenticate_user",
    "list_users",
    "list_champions",
    "create_user",
    "update_user",
]


def authenticate_user(db: Session, payload: LoginRequest) -> tuple[str, User]:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user.email, user.role, user.id)
    return token, user


def list_users(db: Session) -> list[User]:
    return db.scalars(select(User).order_by(User.full_name)).all()


def list_champions(db: Session) -> list[User]:
    return db.scalars(
        select(User).where(User.role == "researcher", User.is_active.is_(True)).order_by(User.full_name)
    ).all()


def create_user(db: Session, payload: UserCreate, request: Request, actor: User) -> User:
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Email already exists")
    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(user)
    db.flush()
    audit(db, actor, "create_user", "user", user.id, request, new_value=f"role={user.role}")
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate, request: Request, actor: User) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old = f"role={user.role}; active={user.is_active}"
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    audit(db, actor, "update_user", "user", user.id, request, old_value=old, new_value=f"role={user.role}; active={user.is_active}")
    db.commit()
    db.refresh(user)
    return user
