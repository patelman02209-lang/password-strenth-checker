"""Enumerations stored as short strings (MySQL-friendly with SQLAlchemy Enum)."""
from __future__ import annotations

import enum


@enum.unique
class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


@enum.unique
class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"
    SUSPENDED = "SUSPENDED"
