"""add unique constraint for evaluation external id

Revision ID: 0003_eval_external_unique
Revises: 0002_add_core_support_tables
Create Date: 2026-04-22
"""

from alembic import op

revision = '0003_eval_external_unique'
down_revision = '0002_add_core_support_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_evaluation_results_external_eval_id',
        'evaluation_results',
        ['external_eval_id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_evaluation_results_external_eval_id',
        'evaluation_results',
        type_='unique',
    )
