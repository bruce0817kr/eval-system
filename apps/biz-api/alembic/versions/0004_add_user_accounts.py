"""add user accounts

Revision ID: 0004_add_user_accounts
Revises: 0003_eval_external_unique
Create Date: 2026-04-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_add_user_accounts"
down_revision = "0003_eval_external_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("login_id", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("login_id"),
    )
    op.create_index("ix_user_accounts_login_id", "user_accounts", ["login_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_accounts_login_id", table_name="user_accounts")
    op.drop_table("user_accounts")
