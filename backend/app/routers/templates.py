from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import PartnerCategory, Template, User
from ..schemas import (
    PartnerCategoryCreate,
    PartnerCategoryOut,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)

router = APIRouter(tags=["Template Library"])


@router.get("/template-categories", response_model=list[PartnerCategoryOut])
def list_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(PartnerCategory).where(PartnerCategory.is_active.is_(True)).order_by(PartnerCategory.name)).all()


@router.post("/template-categories", response_model=PartnerCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: PartnerCategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages")),
):
    """BR-003: administrators can add new partner categories later."""
    if db.scalar(select(PartnerCategory).where(PartnerCategory.name == payload.name)):
        raise HTTPException(status_code=409, detail="Category already exists")
    item = PartnerCategory(**payload.model_dump())
    db.add(item)
    db.flush()
    audit(db, actor, "create_partner_category", "partner_category", item.id, request, new_value=item.name)
    db.commit()
    db.refresh(item)
    return item


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(
    agreement_type: str | None = None,
    partner_category: str | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Template).order_by(Template.partner_category, Template.name)
    if not (include_inactive and user.role in {"admin", "linkages"}):
        stmt = stmt.where(Template.is_active.is_(True))
    if agreement_type:
        stmt = stmt.where(Template.agreement_type == agreement_type)
    if partner_category:
        stmt = stmt.where(Template.partner_category == partner_category)
    return db.scalars(stmt).all()


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages")),
):
    """FR-007: configurable template library by agreement type and partner category."""
    item = Template(**payload.model_dump(), created_by_id=actor.id)
    db.add(item)
    db.flush()
    audit(db, actor, "create_template", "template", item.id, request, new_value=f"{item.name} v{item.version}")
    db.commit()
    db.refresh(item)
    return item


@router.put("/templates/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages")),
):
    item = db.get(Template, template_id)
    if not item:
        raise HTTPException(status_code=404, detail="Template not found")
    changes = payload.model_dump(exclude_unset=True)
    old_version = item.version
    body_changed = "body" in changes and changes["body"] != item.body
    for key, value in changes.items():
        setattr(item, key, value)
    if body_changed:
        # FR-008: content edits create a new template version; existing agreements
        # keep the exact version they were generated from.
        major, _, minor = item.version.partition(".")
        item.version = f"{major}.{int(minor or 0) + 1}"
    audit(db, actor, "update_template", "template", item.id, request, old_value=f"v{old_version}", new_value=f"v{item.version}")
    db.commit()
    db.refresh(item)
    return item
