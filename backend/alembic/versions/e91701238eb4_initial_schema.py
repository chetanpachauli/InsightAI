"""initial schema

Creates the five core application tables (users, uploaded_files, alert_rules,
audit_logs, document_chunks). Dynamic ETL tables (data_*, finance_*) are
managed at runtime by the pipeline and are intentionally NOT touched here, so
existing user data is never dropped by a migration.

Revision ID: e91701238eb4
Revises:
Create Date: 2026-08-15 23:27:25.349833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e91701238eb4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(name: str) -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(name)


def upgrade() -> None:
    """Create core tables if they don't already exist (idempotent)."""

    if not table_exists("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("email", sa.String(), unique=True, index=True, nullable=False),
            sa.Column("hashed_password", sa.String(), nullable=False),
            sa.Column("role", sa.String(), nullable=False, server_default="Employee"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not table_exists("uploaded_files"):
        op.create_table(
            "uploaded_files",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("file_path", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="PENDING"),
            sa.Column("workflow_status", sa.String(), nullable=False, server_default="DRAFT"),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("lineage_info", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not table_exists("alert_rules"):
        op.create_table(
            "alert_rules",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("rule_type", sa.String(), nullable=False, server_default="CUSTOM"),
            sa.Column("condition_col", sa.String(), nullable=False),
            sa.Column("operator", sa.String(), nullable=False),
            sa.Column("value", sa.String(), nullable=False),
            sa.Column("action_type", sa.String(), nullable=False, server_default="ALERT"),
            sa.Column("recipient", sa.String(), nullable=True),
            sa.Column("webhook_url", sa.String(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not table_exists("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("lineage_step", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not table_exists("document_chunks"):
        op.create_table(
            "document_chunks",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("filename", sa.String(), nullable=False, index=True),
            sa.Column("chunk_index", sa.Integer(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("embedding", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Drop core tables in reverse dependency order (data loss only on explicit downgrade)."""
    op.drop_table("document_chunks")
    op.drop_table("audit_logs")
    op.drop_table("alert_rules")
    op.drop_table("uploaded_files")
    op.drop_table("users")
