from pydantic import BaseModel
from typing import Optional, List
import datetime

class OrganizationBase(BaseModel):
    name: str

class Organization(OrganizationBase):
    id: int
    credits_balance: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    role: str
    is_approved: bool
    credits: int
    current_org_id: Optional[int] = None

    class Config:
        from_attributes = True

class JobCreate(BaseModel):
    cmd: Optional[str] = None
    cpu_req: int = 1
    ram_req: int = 512
    require_gpu: bool = False
    container_image: Optional[str] = None
    code_content: Optional[str] = None
    dataset_name: Optional[str] = None
    run_overnight: bool = False
    pip_packages: Optional[str] = None
    workspace_id: Optional[str] = "personal"

class Job(BaseModel):
    id: str
    status: str
    cmd: Optional[str] = None
    cpu_req: int
    ram_req: int
    gpu_req: bool
    workspace_id: str
    owner_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    email: str
    is_approved: bool

class LoginRequest(BaseModel):
    email: str
    password: str
