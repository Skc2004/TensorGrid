from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="student")
    is_approved = Column(Boolean, default=False)
    credits = Column(Integer, default=100)
    current_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    
    jobs = relationship("Job", back_populates="owner")
    org_memberships = relationship("OrganizationMember", back_populates="user")
    current_org = relationship("Organization", foreign_keys=[current_org_id])

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    credits_balance = Column(Integer, default=10000)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    members = relationship("OrganizationMember", back_populates="organization")
    jobs = relationship("Job", back_populates="organization")

class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member") # admin, member
    
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="org_memberships")


class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True)
    status = Column(String, default="Queued")
    cmd = Column(String)
    cpu_req = Column(Integer, default=1)
    ram_req = Column(Integer, default=512)
    gpu_req = Column(Boolean, default=False)
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    owner = relationship("User", back_populates="jobs")
    organization = relationship("Organization", back_populates="jobs")
