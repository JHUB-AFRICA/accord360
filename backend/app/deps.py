from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db.session import get_db
from .models import AuditLog, User
from .core.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("uid"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.get(User, int(payload["uid"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account unavailable")
    return user


def require_roles(*roles: str) -> Callable:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        return user

    return dependency


def audit(
    db: Session,
    actor: User | None,
    action: str,
    object_type: str,
    object_id: str | int,
    request: Request | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    source_ip = request.client.host if request and request.client else None
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            object_type=object_type,
            object_id=str(object_id),
            old_value=old_value,
            new_value=new_value,
            source_ip=source_ip,
        )
    )
