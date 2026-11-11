"""Create real (non-demo) accounts and the reference data a new database needs.

Use this instead of the demo seed on a fresh database — locally or in the
Docker/Postgres stack:

    python -m app.bootstrap --email you@example.org --name "Your Name" --role linkages
    python -m app.bootstrap --email a@example.org --name "A" --role legal --password '...'

The password is prompted for when --password is omitted (so it stays out of
shell history). Existing emails are left untouched. Field definitions (the
Researcher form's required fields) are created if missing.
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import select

from .core.security import hash_password
from .db.session import SessionLocal
from .models import User
from .seed import seed_field_definitions

ROLES = ("researcher", "linkages", "legal", "me", "admin")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a real Accord 360 account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", required=True, choices=ROLES)
    parser.add_argument("--department", default=None)
    parser.add_argument("--password", default=None, help="Prompted for if omitted.")
    args = parser.parse_args(argv)

    email = args.email.strip().lower()
    password = args.password or getpass.getpass(f"Password for {email}: ")
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        seed_field_definitions(db)
        if db.scalar(select(User).where(User.email == email)):
            db.commit()
            print(f"{email} already exists — left unchanged.")
            return 0
        db.add(User(full_name=args.name.strip(), email=email, password_hash=hash_password(password), role=args.role, department=args.department))
        db.commit()
        print(f"Created {args.role} account for {email}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
