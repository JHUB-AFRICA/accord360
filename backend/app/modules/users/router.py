from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import get_current_user, require_roles
from . import service
from .models import User
from .schemas import DemoSignupRequest, LoginRequest, TokenResponse, UserCreate, UserOut, UserUpdate

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])


@auth_router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    token, user = service.authenticate_user(db, payload)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@auth_router.get("/config")
def auth_config():
    from app.core.config import settings

    return {"demo_signup_enabled": settings.allow_demo_signup}


@auth_router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: DemoSignupRequest, request: Request, db: Session = Depends(get_db)):
    token, user = service.signup_demo_user(db, payload, request)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@auth_router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

router = APIRouter(prefix="/users", tags=["Users"])


# NOTE(rebuild-phase0): admin/director_linkages removed per REBUILD_BRIEF.md
# Section 1. Per ground rule 0.1, admin-shaped capabilities belong to
# linkages instead.
@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("linkages")),
):
    return service.list_users(db)




@router.get("/researchers", response_model=list[UserOut])
def list_researchers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("linkages")),
):
    return service.list_researchers(db)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    return service.create_user(db, payload, request, actor)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    return service.update_user(db, user_id, payload, request, actor)

__all__ = ["auth_router", "router"]
