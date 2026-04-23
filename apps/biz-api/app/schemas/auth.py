from pydantic import BaseModel, Field
from typing import Literal


class LoginRequest(BaseModel):
    login_id: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str = Field(..., min_length=1)
    token_type: str = Field(default="bearer")


class CurrentUserResponse(BaseModel):
    login_id: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)


class UserCreateRequest(BaseModel):
    login_id: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    role: Literal["ADMIN", "OPERATOR"] = "OPERATOR"
    is_active: bool = True


class UserRead(BaseModel):
    login_id: str
    role: str
    is_active: bool
