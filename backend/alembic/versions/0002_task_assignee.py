"""Link a task to the user it is assigned to.

Revision ID: 0002_task_assignee
Revises: 0001_initial
Create Date: 2026-11-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_task_assignee"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the optional assignee on tasks."""
    op.add_column("tasks", sa.Column("assignee_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_assignee_user_id",
        "tasks",
        "users",
        ["assignee_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_assignee_user_id", "tasks", ["assignee_user_id"])


def downgrade() -> None:
    """Remove the task assignee link."""
    op.drop_index("ix_tasks_assignee_user_id", table_name="tasks")
    op.drop_constraint("fk_tasks_assignee_user_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "assignee_user_id")
