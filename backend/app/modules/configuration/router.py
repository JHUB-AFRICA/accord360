from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_roles
from app.modules.users.models import User

from . import service
from .schemas import ConfigurationCreate, ConfigurationOut, ConfigurationUpdate, ReferenceDataCreate, ReferenceDataOut, ReferenceDataUpdate

router = APIRouter(tags=["Configuration"])


@router.get("/configuration", response_model=list[ConfigurationOut])
def list_configuration(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    return service.list_configuration(db)


@router.post("/configuration", response_model=ConfigurationOut, status_code=status.HTTP_201_CREATED)
def create_configuration(payload: ConfigurationCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_roles("admin"))):
    try:
        return service.create_configuration(db, payload, actor, request)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/configuration/{key}", response_model=ConfigurationOut)
def update_configuration(key: str, payload: ConfigurationUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_roles("admin"))):
    try:
        return service.update_configuration(db, key, payload, actor, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/reference-data", response_model=list[ReferenceDataOut])
def list_reference_data(category: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return service.list_reference_data(db, category)


@router.post("/reference-data", response_model=ReferenceDataOut, status_code=status.HTTP_201_CREATED)
def create_reference_data(payload: ReferenceDataCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_roles("admin"))):
    try:
        return service.create_reference_data(db, payload, actor, request)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/reference-data/{item_id}", response_model=ReferenceDataOut)
def update_reference_data(item_id: int, payload: ReferenceDataUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_roles("admin"))):
    try:
        return service.update_reference_data(db, item_id, payload, actor, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
