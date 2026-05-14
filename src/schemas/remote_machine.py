"""Schemas for user remote lab machines and session bindings."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


RemoteAuthType = Literal["existing", "password", "key"]


class RemoteMachineBase(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    runner_machine_name: str = Field(min_length=1, max_length=120)
    host: Optional[str] = Field(default=None, max_length=255)
    port: Optional[int] = Field(default=22, ge=1, le=65535)
    username: Optional[str] = Field(default=None, max_length=120)
    auth_type: RemoteAuthType = "existing"
    key_path: Optional[str] = Field(default=None, max_length=512)
    default_cwd: Optional[str] = Field(default=None, max_length=512)
    startup_commands: List[str] = Field(default_factory=list, max_length=10)

    @field_validator("display_name", "runner_machine_name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be empty")
        return cleaned

    @field_validator("host", "username", "key_path", "default_cwd")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("startup_commands")
    @classmethod
    def strip_startup_commands(cls, value: List[str]) -> List[str]:
        return [item.strip() for item in value if item.strip()]


class RemoteMachineCreate(RemoteMachineBase):
    password: Optional[str] = Field(default=None, max_length=4096)


class RemoteMachineUpdate(RemoteMachineBase):
    password: Optional[str] = Field(
        default=None,
        max_length=4096,
        description="Omit or send an empty value to keep the existing secret.",
    )


class RemoteMachineSummary(RemoteMachineBase):
    machine_id: str
    has_password: bool = False
    status: str = "untested"
    last_error: Optional[str] = None
    last_checked_at: Optional[str] = None


class RemoteMachineTestResponse(BaseModel):
    ok: bool
    status: str
    message: str = ""
    detail: dict = Field(default_factory=dict)


class RemoteBindingSummary(BaseModel):
    binding_id: str
    machine_id: Optional[str] = None
    display_name: Optional[str] = None
    runner_machine_name: str
    runner_session_id: str
    default_cwd: Optional[str] = None
    status: str


class SessionRemoteBindingUpdateRequest(BaseModel):
    remote_machine_id: Optional[str] = Field(
        default=None,
        description="User remote machine to bind, or null to detach the session.",
    )


class RemoteCommandAudit(BaseModel):
    audit_id: str
    session_id: str
    binding_id: Optional[str] = None
    runner_session_id: Optional[str] = None
    terminal_id: str = "session"
    action: str
    command: Optional[str] = None
    cwd: Optional[str] = None
    exit_code: Optional[int] = None
    stdout_excerpt: Optional[str] = None
    stderr_excerpt: Optional[str] = None
    error: Optional[str] = None
    create_at: Optional[str] = None


class SessionRemoteCommandRequest(BaseModel):
    action: str = Field(default="session_exec", max_length=80)
    command: Optional[str] = Field(default=None, max_length=4000)
    command_id: Optional[str] = Field(default=None, max_length=160)
    cwd: Optional[str] = Field(default=None, max_length=512)
    reason: Optional[str] = Field(default=None, max_length=300)
    wait_timeout_seconds: Optional[int] = Field(default=None, ge=1, le=120)


class SessionRemoteCommandResponse(BaseModel):
    ok: bool
    action: str
    reason: str = ""
    result: Dict[str, Any] = Field(default_factory=dict)


class SessionRemoteShellReadResponse(BaseModel):
    ok: bool = True
    runner_session_id: str
    transcript: str = ""
    cursor: int = 0
    since: int = 0
    transcript_truncated: bool = False
    result: Dict[str, Any] = Field(default_factory=dict)


class SessionFileInfo(BaseModel):
    filename: str
    size_bytes: int
    uploaded_at: Optional[str] = None


class SessionFileRemotePutRequest(BaseModel):
    remote_path: str = Field(min_length=1, max_length=1024)


class SessionFileRemotePutResponse(BaseModel):
    ok: bool
    local_filename: str
    remote_path: str
    result: Dict[str, Any] = Field(default_factory=dict)
