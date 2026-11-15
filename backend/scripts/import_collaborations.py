"""Import the reviewed JKUAT collaboration workbook into Accord360.

The importer is intentionally dry-run by default. It creates historical
agreements as ``pending_review`` records and uses the supplied owner only as a
temporary database assignment until Linkages confirms the real Champion.
"""

from __future__ import annotations

import argparse
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Agreement, AuditLog, Deliverable, Partner, User, WorkflowEvent
from app.timeutils import utc_now


def text(value) -> str:
    return str(value).strip() if value is not None else ""


def truthy(value) -> bool:
    return text(value).lower() in {"1", "true", "yes", "y"}


def normalized_key(value: str) -> str:
    return " ".join(value.casefold().split())


def as_date(value):
    value = text(value)
    if not value:
        return None
    try:
        from datetime import date
        return date.fromisoformat(value)
    except ValueError:
        return None


def as_decimal(value) -> Decimal:
    value = text(value).replace(",", "")
    if not value:
        return Decimal("0")
    try:
        return Decimal(value)
    except InvalidOperation:
        return Decimal("0")


def import_workbook(path: Path, owner_email: str, commit: bool) -> dict[str, int]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    if "agreements_import" not in workbook.sheetnames or "partners_import" not in workbook.sheetnames:
        raise ValueError("Workbook must contain agreements_import and partners_import sheets")

    db = SessionLocal()
    try:
        owner = db.scalar(select(User).where(User.email == owner_email.lower()))
        if not owner:
            raise ValueError(f"Temporary review owner was not found: {owner_email}")
        partners: dict[str, Partner] = {}
        for partner in db.scalars(select(Partner)).all():
            partners[normalized_key(partner.name)] = partner

        partner_rows = list(workbook["partners_import"].iter_rows(values_only=True))
        partner_headers = [text(value) for value in partner_rows[0]]
        for values in partner_rows[1:]:
            row = dict(zip(partner_headers, values))
            name = text(row.get("partner_name"))
            if not name:
                continue
            key = normalized_key(name)
            if key in partners:
                continue
            partner = Partner(
                name=name,
                sector=text(row.get("sector")) or "Not recorded",
                partner_type=text(row.get("partner_type")) or "Institution",
                country=text(row.get("country")) or "Not recorded",
                contact_name=text(row.get("contact_name")) or None,
                contact_email=text(row.get("contact_email")) or None,
                legal_counterpart=text(row.get("legal_counterpart")) or None,
                liaison=text(row.get("liaison")) or None,
                status=text(row.get("status")) or "under_review",
            )
            db.add(partner)
            db.flush()
            partners[key] = partner

        rows = list(workbook["agreements_import"].iter_rows(values_only=True))
        headers = [text(value) for value in rows[0]]
        agreements_by_reference = {item.reference_number: item for item in db.scalars(select(Agreement)).all()}
        existing = set(agreements_by_reference)
        imported = skipped = 0
        for values in rows[1:]:
            row = dict(zip(headers, values))
            reference = text(row.get("agreement_reference"))
            partner_name = text(row.get("partner_name"))
            if not reference:
                skipped += 1
                continue
            if not partner_name:
                partner_name = f"Unidentified partner – source row {text(row.get('source_row_number')) or reference}"
            if reference in existing:
                skipped += 1
                continue
            partner = partners.get(normalized_key(partner_name))
            if not partner:
                notes = text(row.get("data_quality_note"))
                partner = Partner(name=partner_name, sector="Not recorded", partner_type="Institution", country="Not recorded", status="under_review")
                db.add(partner)
                db.flush()
                partners[normalized_key(partner_name)] = partner
                notes = f"{notes}; Partner was missing from partners_import and was created from the agreement row for Linkages review.".strip("; ")

            notes = text(row.get("data_quality_note"))
            if not text(row.get("partner_name")):
                notes = f"{notes}; Partner name was blank in the source and requires Linkages correction.".strip("; ")
            if not text(row.get("owner_email")):
                notes = f"{notes}; Temporary owner assigned for import: {owner.email}".strip("; ")
            agreement = Agreement(
                reference_number=reference,
                title=text(row.get("agreement_title")) or f"Historical collaboration with {partner.name}",
                agreement_type=text(row.get("agreement_type")) or "Other",
                purpose=text(row.get("purpose")) or "Historical collaboration record imported from the JKUAT collaboration database.",
                expected_outcomes=text(row.get("expected_outcomes")) or None,
                strategic_alignment=text(row.get("strategic_alignment")) or None,
                department=text(row.get("department")) or "Not recorded",
                stage=text(row.get("stage")) or "initiation",
                status=text(row.get("status")) or "unknown",
                status_color=text(row.get("status_color")) or "yellow",
                next_action=text(row.get("next_action")) or "Historical record requires Linkages review",
                confidentiality=text(row.get("confidentiality")) or "internal",
                owner_id=owner.id,
                initiator_id=None,
                partner_id=partner.id,
                internal_champion=None,
                partner_liaison=text(row.get("partner_liaison")) or None,
                assigned_linkages_id=None,
                assigned_approver_id=None,
                legal_reviewer_id=None,
                effective_date=as_date(row.get("start_date")),
                expiry_date=as_date(row.get("end_date")),
                source_row_number=int(text(row.get("source_row_number")) or 0) or None,
                source_section=text(row.get("source_section")) or None,
                source_date_raw=text(row.get("source_date_raw")) or None,
                source_type_raw=text(row.get("source_type_raw")) or None,
                source_status_raw=text(row.get("source_status_raw")) or None,
                source_purpose_raw=text(row.get("source_purpose_raw")) or None,
                data_quality_status="pending_review",
                data_quality_note=notes or "Imported historical record; review and verify before operational use.",
            )
            db.add(agreement)
            db.flush()
            agreements_by_reference[reference] = agreement
            db.add(WorkflowEvent(agreement_id=agreement.id, from_stage=None, to_stage=agreement.stage, action="historical_import", comment="Imported from the JKUAT collaboration workbook; pending Linkages review.", actor_id=owner.id))
            db.add(AuditLog(actor_id=owner.id, action="import_agreement", object_type="agreement", object_id=str(agreement.id), new_value=reference, created_at=utc_now()))
            existing.add(reference)
            imported += 1

        imported_deliverables = skipped_deliverables = 0
        existing_deliverables = {
            (item.agreement_id, item.deliverable_type, item.reporting_period)
            for item in db.scalars(select(Deliverable)).all()
        }
        if "deliverables_import" in workbook.sheetnames:
            deliverable_rows = list(workbook["deliverables_import"].iter_rows(values_only=True))
            deliverable_headers = [text(value) for value in deliverable_rows[0]]
            for values in deliverable_rows[1:]:
                row = dict(zip(deliverable_headers, values))
                agreement = agreements_by_reference.get(text(row.get("agreement_reference")))
                deliverable_type = text(row.get("deliverable_type"))
                if not agreement or not deliverable_type:
                    skipped_deliverables += 1
                    continue
                key = (agreement.id, deliverable_type, text(row.get("reporting_period")) or None)
                if key in existing_deliverables:
                    skipped_deliverables += 1
                    continue
                db.add(Deliverable(
                    agreement_id=agreement.id,
                    deliverable_type=deliverable_type,
                    target_value=as_decimal(row.get("target_value")),
                    actual_value=as_decimal(row.get("actual_value")),
                    reporting_period=text(row.get("reporting_period")) or None,
                    notes=text(row.get("notes")) or None,
                ))
                existing_deliverables.add(key)
                imported_deliverables += 1

        if commit:
            db.commit()
        else:
            db.rollback()
        return {
            "imported": imported,
            "skipped": skipped,
            "partners_seen": len(partners),
            "deliverables_imported": imported_deliverables,
            "deliverables_skipped": skipped_deliverables,
            "committed": int(commit),
        }
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--owner-email", required=True, help="Temporary Champion account used until Linkages assigns the real owner")
    parser.add_argument("--commit", action="store_true", help="Persist changes; without this flag the import is a dry run")
    args = parser.parse_args()
    if not args.file.exists():
        raise SystemExit(f"Workbook not found: {args.file}")
    result = import_workbook(args.file, args.owner_email, args.commit)
    mode = "committed" if args.commit else "dry run"
    print(f"Import {mode}: {result}")


if __name__ == "__main__":
    main()
