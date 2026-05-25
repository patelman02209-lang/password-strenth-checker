"""Vault security metadata columns (reuse token, scores, breach flag, rotation anchor).

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-05-14

Adds non-plaintext columns for dashboards, CSV export, and duplicate-password hints.
``password_reuse_hmac`` must never be exposed in API responses or logs.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("stored_credentials", sa.Column("entropy_bits", sa.Float(), nullable=True))
    op.add_column("stored_credentials", sa.Column("complexity_score", sa.Integer(), nullable=True))
    op.add_column(
        "stored_credentials",
        sa.Column("is_breached", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("stored_credentials", sa.Column("password_reuse_hmac", sa.LargeBinary(length=32), nullable=True))
    op.add_column("stored_credentials", sa.Column("password_set_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_stored_credentials_user_reuse_hmac",
        "stored_credentials",
        ["user_id", "password_reuse_hmac"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_stored_credentials_user_reuse_hmac", table_name="stored_credentials")
    op.drop_column("stored_credentials", "password_set_at")
    op.drop_column("stored_credentials", "password_reuse_hmac")
    op.drop_column("stored_credentials", "is_breached")
    op.drop_column("stored_credentials", "complexity_score")
    op.drop_column("stored_credentials", "entropy_bits")
