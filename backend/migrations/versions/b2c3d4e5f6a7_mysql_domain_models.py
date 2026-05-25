"""MySQL-oriented domain models (users, checks, credentials, demos, audit).

Revision ID: b2c3d4e5f6a7
Revises: 8a5cce50c256
Create Date: 2026-05-14

Replaces legacy roles/vault_items schema with unified tables.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "8a5cce50c256"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())
    for tbl in ("vault_items", "users", "roles"):
        if tbl in existing:
            op.drop_table(tbl)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("password_hash_algorithm", sa.String(length=32), nullable=False, server_default="argon2id"),
        sa.Column("role", sa.String(length=16), nullable=False, server_default="USER"),
        sa.Column("two_factor_secret", sa.String(length=64), nullable=True),
        sa.Column("is_two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_name"), "users", ["name"], unique=False)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index(op.f("ix_users_status"), "users", ["status"], unique=False)
    op.create_index(op.f("ix_users_password_hash_algorithm"), "users", ["password_hash_algorithm"], unique=False)

    op.create_table(
        "password_checks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("entropy_score", sa.Float(), nullable=False),
        sa.Column("complexity_score", sa.Integer(), nullable=False),
        sa.Column("strength_label", sa.String(length=64), nullable=False),
        sa.Column("is_common_password", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_breached", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("breach_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("detected_patterns", sa.JSON(), nullable=True),
        sa.Column("suggestions", sa.JSON(), nullable=True),
        sa.Column("crack_time_estimate", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_password_checks_user_id"), "password_checks", ["user_id"], unique=False)
    op.create_index("ix_password_checks_user_created", "password_checks", ["user_id", "created_at"], unique=False)
    op.create_index(op.f("ix_password_checks_created_at"), "password_checks", ["created_at"], unique=False)

    op.create_table(
        "stored_credentials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("username_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("password_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("website_url", sa.String(length=512), nullable=True),
        sa.Column("notes_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("strength_label", sa.String(length=64), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stored_credentials_user_id"), "stored_credentials", ["user_id"], unique=False)
    op.create_index("ix_stored_credentials_user_title", "stored_credentials", ["user_id", "title"], unique=False)

    op.create_table(
        "password_hash_demos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("algorithm", sa.String(length=32), nullable=False),
        sa.Column("input_label", sa.String(length=128), nullable=False),
        sa.Column("generated_hash", sa.Text(), nullable=False),
        sa.Column("hash_time_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_password_hash_demos_user_id"), "password_hash_demos", ["user_id"], unique=False)
    op.create_index("ix_password_hash_demos_user_created", "password_hash_demos", ["user_id", "created_at"], unique=False)
    op.create_index(op.f("ix_password_hash_demos_algorithm"), "password_hash_demos", ["algorithm"], unique=False)
    op.create_index(op.f("ix_password_hash_demos_created_at"), "password_hash_demos", ["created_at"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("audit_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_created", "audit_logs", ["user_id", "created_at"], unique=False)
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity", "entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)


def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("password_hash_demos")
    op.drop_table("stored_credentials")
    op.drop_table("password_checks")
    op.drop_table("users")
