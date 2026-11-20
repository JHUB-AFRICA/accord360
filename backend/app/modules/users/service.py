"""User use-cases shared by the HTTP adapter and future adapters."""

from __future__ import annotations

import re

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from ...deps import audit
from .models import User
from .schemas import DemoSignupRequest, LoginRequest, UserCreate, UserUpdate

__all__ = [
    "hash_password",
    "authenticate_user",
    "signup_demo_user",
    "list_users",
    "list_researchers",
    "create_user",
    "update_user",
]


def authenticate_user(db: Session, payload: LoginRequest) -> tuple[str, User]:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user.email, user.role, user.id)
    return token, user


def signup_demo_user(db: Session, payload: DemoSignupRequest, request: Request) -> tuple[str, User]:
    """Self-service demo account: an email and the office the person works for.

    No email verification. Only reachable when ALLOW_DEMO_SIGNUP is enabled.
    """
    from app.core.config import settings

    if not settings.allow_demo_signup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    email = payload.email.lower()
    department = (payload.department or "").strip() or None
    if payload.role == "researcher" and not department:
        raise HTTPException(status_code=422, detail="Researchers must give their department")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="This email already has an account. Sign in instead.")
    name = " ".join(part.capitalize() for part in re.split(r"[._\-+]+", email.split("@")[0]) if part) or email
    user = User(
        full_name=name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=department if payload.role == "researcher" else None,
    )
    db.add(user)
    db.flush()
    audit(db, user, "demo_signup", "user", user.id, request, new_value=f"role={user.role}")
    db.commit()
    db.refresh(user)
    return create_access_token(user.email, user.role, user.id), user


def list_users(db: Session) -> list[User]:
    return db.scalars(select(User).order_by(User.full_name)).all()


def list_researchers(db: Session) -> list[User]:
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
    access_changed = old != f"role={user.role}; active={user.is_active}"
    audit(db, actor, "update_user", "user", user.id, request, old_value=old, new_value=f"role={user.role}; active={user.is_active}")
    db.commit()
    if access_changed:
        # Deactivation or a role change must take this person off every
        # agreement Doc now, not at the next workflow step.
        from app.modules.agreements.service import reconcile_agreements_for_people

        reconcile_agreements_for_people(db, emails={user.email}, researcher_id=user.id)
    db.refresh(user)
    return user
