from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.hash import sha256_crypt
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.auth import authenticate_user, create_access_token
from app.models.entities import UserAccount
from app.schemas.auth import CurrentUserResponse, LoginRequest, TokenResponse, UserCreateRequest, UserRead

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    user = authenticate_user(db, payload.login_id, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login ID or password.")
    return TokenResponse(access_token=create_access_token(user["login_id"], user["role"]), token_type="bearer")


@router.get("/me", response_model=CurrentUserResponse)
def me(current_user: Annotated[dict[str, str], Depends(get_current_user)]) -> CurrentUserResponse:
    return CurrentUserResponse(login_id=current_user["login_id"], role=current_user["role"])


@router.get("/users", response_model=list[UserRead])
def list_users(
    _current_user: Annotated[dict[str, str], Depends(require_roles("ADMIN"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[UserRead]:
    users = db.query(UserAccount).order_by(UserAccount.login_id).all()
    return [UserRead(login_id=user.login_id, role=user.role, is_active=user.is_active) for user in users]


@router.post("/users", response_model=UserRead)
def create_user(
    payload: UserCreateRequest,
    _current_user: Annotated[dict[str, str], Depends(require_roles("ADMIN"))],
    db: Annotated[Session, Depends(get_db)],
) -> UserRead:
    existing_user = db.query(UserAccount).filter(UserAccount.login_id == payload.login_id).one_or_none()
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists.")

    user = UserAccount(
        login_id=payload.login_id,
        password_hash=sha256_crypt.hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead(login_id=user.login_id, role=user.role, is_active=user.is_active)
