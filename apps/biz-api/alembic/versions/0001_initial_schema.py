"""initial schema for biz support hub

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-15
"""

from alembic import op
import sqlalchemy as sa

revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')
    op.create_table(
        'participants',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('participant_type', sa.String(30), nullable=False),
        sa.Column('biz_no', sa.String(20)),
        sa.Column('participant_name', sa.String(255), nullable=False),
        sa.Column('normalized_name', sa.String(255)),
        sa.Column('ceo_name', sa.String(100)),
        sa.Column('region_code', sa.String(50)),
        sa.Column('address', sa.Text()),
        sa.Column('industry_code', sa.String(50)),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('participants')
