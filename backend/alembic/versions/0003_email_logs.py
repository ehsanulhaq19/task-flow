"""Add the email_logs table.

Revision ID: 0003_email_logs
Revises: 0002_task_assignee
Create Date: 2026-11-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_email_logs"
down_revision: Union[str, None] = "0002_task_assignee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create email_logs."""
    op.create_table(
        "email_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("file_attachment", sa.String(1000), nullable=True),
        sa.Column("to_email", sa.String(255), nullable=False),
        sa.Column("from_email", sa.String(255), nullable=True),
        sa.Column("response", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    """Drop email_logs."""
    op.drop_table("email_logs")
