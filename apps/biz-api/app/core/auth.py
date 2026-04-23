from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.hash import sha256_crypt
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import UserAccount

ALGORITHM = "HS256"


def verify_password(password: str, password_hash: str) -> bool:
    return sha256_crypt.verify(password, password_hash)


def authenticate_admin(login_id: str, password: str) -> dict[str, str] | None:
    if login_id != settings.admin_login_id:
        return None
    if not verify_password(password, settings.admin_password_hash):
        return None
    return {"login_id": settings.admin_login_id, "role": settings.admin_role}


def authenticate_user(db: Session, login_id: str, password: str) -> dict[str, str] | None:
    try:
        user = db.query(UserAccount).filter(UserAccount.login_id == login_id).one_or_none()
    except SQLAlchemyError:
        db.rollback()
        return authenticate_admin(login_id, password)

    if user is None:
        return authenticate_admin(login_id, password)
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return {"login_id": user.login_id, "role": user.role}


def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    expires_at = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, str] | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None

    subject = payload.get("sub")
    role = payload.get("role")
    if not isinstance(subject, str) or not isinstance(role, str):
        return None
    return {"login_id": subject, "role": role}
