"""Add user configuration data.

Revision ID: 0005_user_configuration
Revises: 0004_task_comments
Create Date: 2026-11-12

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_user_configuration"
down_revision: Union[str, None] = "0004_task_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Store per-user settings, including an employee's daily hour limits."""
    op.add_column(
        "users",
        sa.Column(
            "configuration_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.execute(
        """
        UPDATE users
        SET configuration_data = jsonb_build_object(
            'minimumHours', daily_target_hours,
            'maximumHours', daily_target_hours + 2
        )
        WHERE role = 'employee'
        """
    )


def downgrade() -> None:
    """Remove user configuration data."""
    op.drop_column("users", "configuration_data")
