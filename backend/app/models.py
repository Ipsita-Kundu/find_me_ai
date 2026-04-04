from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, EmailStr


class MissingPersonBase(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    birthmarks: Optional[str] = None
    last_seen_location: Optional[str] = None
    additional_info: Optional[str] = None


class MissingPersonCreate(MissingPersonBase):
    pass


class MissingPerson(MissingPersonBase):
    model_config = ConfigDict(validate_by_name=True)

    id: str = Field(alias="_id")
    image_path: str
    embedding: List[float]
    created_at: datetime


class FoundPersonBase(BaseModel):
    estimated_age: Optional[int] = None
    gender: Optional[str] = None
    birthmarks: Optional[str] = None
    found_location: Optional[str] = None
    contact_info: Optional[str] = None
    additional_info: Optional[str] = None


class FoundPersonCreate(FoundPersonBase):
    pass


class FoundPerson(FoundPersonBase):
    model_config = ConfigDict(validate_by_name=True)

    id: str = Field(alias="_id")
    image_path: str
    embedding: List[float]
    created_at: datetime


class MatchResult(BaseModel):
    missing_id: str
    found_id: str
    similarity: float


class Alert(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    id: str = Field(alias="_id")
    missing_id: str
    found_id: str
    similarity: float
    missing_contact_phone: Optional[str] = None
    found_contact_phone: Optional[str] = None
    created_at: datetime


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone_number: Optional[str] = None
    provider: str
    role: str


class UserSignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone_number: str = Field(min_length=7)
    role: str = Field(default="user")


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=6)


class GoogleLoginRequest(BaseModel):
    id_token: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
