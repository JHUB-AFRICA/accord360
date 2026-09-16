from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import audit
from app.timeutils import utc_now

from .models import ConfigurationValue, ReferenceData
from .schemas import ConfigurationCreate, ConfigurationUpdate, ReferenceDataCreate, ReferenceDataUpdate


def list_configuration(db: Session) -> list[ConfigurationValue]:
    return db.scalars(select(ConfigurationValue).order_by(ConfigurationValue.category, ConfigurationValue.key)).all()


def create_configuration(db: Session, payload: ConfigurationCreate, actor, request) -> ConfigurationValue:
    if db.scalar(select(ConfigurationValue).where(ConfigurationValue.key == payload.key)):
        raise ValueError("Configuration key already exists")
    item = ConfigurationValue(**payload.model_dump(), updated_by_id=actor.id)
    db.add(item)
    db.flush()
    audit(db, actor, "create_configuration", "configuration", item.id, request, new_value=f"{item.key}={item.value}")
    db.commit()
    db.refresh(item)
    return item


def update_configuration(db: Session, key: str, payload: ConfigurationUpdate, actor, request) -> ConfigurationValue:
    item = db.scalar(select(ConfigurationValue).where(ConfigurationValue.key == key))
    if not item:
        raise LookupError("Configuration key not found")
    if not item.is_editable:
        raise ValueError("This configuration value is not editable")
    old = item.value
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_by_id = actor.id
    audit(db, actor, "update_configuration", "configuration", item.id, request, old_value=old, new_value=item.value)
    db.commit()
    db.refresh(item)
    return item


def list_reference_data(db: Session, category: str | None = None) -> list[ReferenceData]:
    statement = select(ReferenceData).where(ReferenceData.is_active.is_(True)).order_by(ReferenceData.category, ReferenceData.sort_order, ReferenceData.label)
    if category:
        statement = statement.where(ReferenceData.category == category)
    return db.scalars(statement).all()


def create_reference_data(db: Session, payload: ReferenceDataCreate, actor, request) -> ReferenceData:
    if db.scalar(select(ReferenceData).where(ReferenceData.category == payload.category, ReferenceData.code == payload.code)):
        raise ValueError("Reference-data code already exists in this category")
    item = ReferenceData(**payload.model_dump(), created_at=utc_now(), updated_at=utc_now())
    db.add(item)
    db.flush()
    audit(db, actor, "create_reference_data", "reference_data", item.id, request, new_value=f"{item.category}:{item.code}")
    db.commit()
    db.refresh(item)
    return item


def update_reference_data(db: Session, item_id: int, payload: ReferenceDataUpdate, actor, request) -> ReferenceData:
    item = db.get(ReferenceData, item_id)
    if not item:
        raise LookupError("Reference-data item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = utc_now()
    audit(db, actor, "update_reference_data", "reference_data", item.id, request, new_value=item.label)
    db.commit()
    db.refresh(item)
    return item
