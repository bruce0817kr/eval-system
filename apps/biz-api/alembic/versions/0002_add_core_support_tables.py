"""add core support tables

Revision ID: 0002_add_core_support_tables
Revises: 0001_initial_schema
Create Date: 2026-04-17
"""

from alembic import op
import sqlalchemy as sa

revision = '0002_add_core_support_tables'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'programs',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('program_name', sa.String(255), nullable=False),
        sa.Column('sub_program_name', sa.String(255)),
        sa.Column('managing_dept', sa.String(255)),
        sa.Column('funding_source', sa.String(100)),
        sa.Column('total_budget', sa.Numeric(18, 2)),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_table(
        'evaluation_results',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('external_eval_id', sa.String(100)),
        sa.Column('participant_id', sa.UUID(), sa.ForeignKey('participants.id')),
        sa.Column('program_id', sa.UUID(), sa.ForeignKey('programs.id'), nullable=False),
        sa.Column('total_score', sa.Numeric(8, 2)),
        sa.Column('ranking', sa.Integer()),
        sa.Column('selected_yn', sa.Boolean()),
        sa.Column('reserve_yn', sa.Boolean()),
        sa.Column('selected_date', sa.Date()),
        sa.Column('sync_status', sa.String(30), nullable=False, server_default='PENDING'),
        sa.Column('synced_at', sa.DateTime()),
    )
    op.create_table(
        'support_cases',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('participant_id', sa.UUID(), sa.ForeignKey('participants.id'), nullable=False),
        sa.Column('program_id', sa.UUID(), sa.ForeignKey('programs.id'), nullable=False),
        sa.Column('evaluation_result_id', sa.UUID(), sa.ForeignKey('evaluation_results.id')),
        sa.Column('selection_result', sa.String(30), nullable=False, server_default='APPLIED'),
        sa.Column('agreement_status', sa.String(30), nullable=False, server_default='NOT_STARTED'),
        sa.Column('execution_status', sa.String(30), nullable=False, server_default='NOT_PAID'),
        sa.Column('settlement_status', sa.String(30), nullable=False, server_default='NOT_SUBMITTED'),
        sa.Column('completion_status', sa.String(30), nullable=False, server_default='NOT_COMPLETED'),
        sa.Column('support_amount', sa.Numeric(18, 2)),
        sa.Column('self_fund_amount', sa.Numeric(18, 2)),
        sa.Column('remarks', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_table(
        'support_case_status_histories',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('support_case_id', sa.UUID(), sa.ForeignKey('support_cases.id'), nullable=False),
        sa.Column('status_category', sa.String(50), nullable=False),
        sa.Column('old_value', sa.String(50)),
        sa.Column('new_value', sa.String(50)),
        sa.Column('changed_by', sa.String(100)),
        sa.Column('changed_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_table(
        'attachments',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('support_case_id', sa.UUID(), sa.ForeignKey('support_cases.id'), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('original_file_name', sa.String(255), nullable=False),
        sa.Column('drive_file_id', sa.String(255), nullable=False),
        sa.Column('drive_web_link', sa.Text()),
        sa.Column('folder_path', sa.Text()),
        sa.Column('version_no', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_latest', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_table(
        'staging_support_raw',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('source_file_name', sa.String(255), nullable=False),
        sa.Column('source_sheet_name', sa.String(255)),
        sa.Column('row_no', sa.Integer()),
        sa.Column('participant_name_raw', sa.Text()),
        sa.Column('biz_no_raw', sa.Text()),
        sa.Column('program_name_raw', sa.Text()),
        sa.Column('sub_program_name_raw', sa.Text()),
        sa.Column('support_amount_raw', sa.Text()),
        sa.Column('raw_payload_json', sa.JSON()),
        sa.Column('imported_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('staging_support_raw')
    op.drop_table('attachments')
    op.drop_table('support_case_status_histories')
    op.drop_table('support_cases')
    op.drop_table('evaluation_results')
    op.drop_table('programs')
