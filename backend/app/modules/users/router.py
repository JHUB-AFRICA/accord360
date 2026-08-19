from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import get_current_user, require_roles
from . import service
from .models import User
from .schemas import LoginRequest, TokenResponse, UserCreate, UserOut, UserUpdate

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])


@auth_router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    token, user = service.authenticate_user(db, payload)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@auth_router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    return service.list_users(db)




@router.get("/champions", response_model=list[UserOut])
def list_champions(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "linkages", "director_linkages")),
):
    return service.list_champions(db)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
):
    return service.create_user(db, payload, request, actor)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
):
    return service.update_user(db, user_id, payload, request, actor)

__all__ = ["auth_router", "router"]
