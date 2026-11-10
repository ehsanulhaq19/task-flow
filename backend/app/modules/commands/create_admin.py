"""
Create an admin user and the organization they belong to.

Run from the backend container and answer the prompts::

    docker exec -it taskflow-backend python -m app.modules.commands.create_admin

An organization with the same name is reused. A new one is created when that
name does not exist.
"""

from __future__ import annotations

import asyncio
import getpass
import re
import sys

from sqlalchemy import func, or_, select

from app.core.exceptions import AppException
from app.database import async_session
from app.modules.admin.schemas import OrganizationCreate, UserCreate
from app.modules.admin.service import create_organization, create_user, slugify
from app.modules.organization.models import Organization

LOGIN_URL = "https://imehsan.com/taskflow/login"
ADMIN_URL = "https://imehsan.com/taskflow/admin"
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _prompt(label: str) -> str:
    """Keep asking until the line is not blank."""
    while True:
        value = input(f"{label}: ").strip()
        if value:
            return value
        print(f"{label} is required.")


def _prompt_email() -> str:
    """Keep asking until the address looks valid."""
    while True:
        email = _prompt("Email").lower()
        if _EMAIL.match(email):
            return email
        print("Enter a valid email address.")


def _prompt_organization() -> str:
    """Keep asking until the organization name can be stored."""
    while True:
        name = _prompt("Organization")
        if len(name) >= 2 and slugify(name):
            return name
        print("Organization name must be at least 2 characters.")


def _prompt_password() -> str:
    """Ask for a password twice and repeat the pair when they differ."""
    while True:
        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if len(password) < 4:
            print("Password must be at least 4 characters.")
            continue
        if password != confirm:
            print("Passwords do not match.")
            continue
        return password


def _prompt_job_title() -> str:
    """Use Administrator when the job title line is left empty."""
    value = input("Job title [Administrator]: ").strip()
    return value or "Administrator"


async def _organization_by_name(db, name: str) -> Organization | None:
    slug = slugify(name)
    result = await db.execute(
        select(Organization).where(or_(func.lower(Organization.name) == name.lower(), Organization.slug == slug))
    )
    return result.scalars().first()


async def create_admin_user(
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    organization_name: str,
    job_title: str,
) -> int:
    """Create the organization when needed, then the admin. Returns a process exit code."""
    async with async_session() as db:
        try:
            organization = await _organization_by_name(db, organization_name)
            created_organization = organization is None
            if organization is None:
                organization = await create_organization(db, OrganizationCreate(name=organization_name))
            user = await create_user(
                db,
                UserCreate(
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    password=password,
                    role="admin",
                    organization_id=organization.id,
                    job_title=job_title or "Administrator",
                ),
            )
            await db.commit()
        except AppException as exc:
            await db.rollback()
            print(exc.detail, file=sys.stderr)
            return 1
        except Exception as exc:
            await db.rollback()
            print(str(exc), file=sys.stderr)
            return 1

    print(f"Admin created: {user.email}")
    print(f"Name: {user.first_name} {user.last_name}")
    print(f"Organization: {organization.name}" + (" (created)" if created_organization else " (existing)"))
    print(f"Sign in: {LOGIN_URL}")
    print(f"Admin panel: {ADMIN_URL}")
    return 0


def main() -> int:
    """Ask for each field, then create the admin."""
    print("Create a Taskflow admin")
    first_name = _prompt("First name")
    last_name = _prompt("Last name")
    email = _prompt_email()
    organization_name = _prompt_organization()
    job_title = _prompt_job_title()
    password = _prompt_password()
    return asyncio.run(
        create_admin_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            organization_name=organization_name,
            job_title=job_title,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
