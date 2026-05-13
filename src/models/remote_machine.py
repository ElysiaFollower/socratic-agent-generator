"""Remote lab machine models for session-bound Tutor tools."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from .base import Base


class UserRemoteMachineModel(Base):
    """Per-user Remote Runner machine configuration."""

    __tablename__ = "user_remote_machines"

    machine_id = Column(String, primary_key=True, index=True)
    owner_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    display_name = Column(String, nullable=False)
    runner_machine_name = Column(String, nullable=False)
    host = Column(String, nullable=True)
    port = Column(Integer, nullable=True)
    username = Column(String, nullable=True)
    auth_type = Column(String, nullable=False)
    password_secret = Column(Text, nullable=True)
    key_path = Column(String, nullable=True)
    default_cwd = Column(String, nullable=True)
    startup_commands = Column(JSON, default=[])
    status = Column(String, nullable=False, default="untested")
    last_error = Column(Text, nullable=True)
    last_checked_at = Column(String, nullable=True)
    create_at = Column(DateTime(timezone=True), server_default=func.now())
    update_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SessionRemoteBindingModel(Base):
    """Binds one Socratic session to one Remote Runner session."""

    __tablename__ = "session_remote_bindings"

    binding_id = Column(String, primary_key=True, index=True)
    session_id = Column(
        String,
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    owner_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    user_machine_id = Column(
        String,
        ForeignKey("user_remote_machines.machine_id", ondelete="SET NULL"),
        nullable=True,
    )
    runner_machine_name = Column(String, nullable=False)
    runner_session_id = Column(String, nullable=False)
    default_cwd = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")
    last_error = Column(Text, nullable=True)
    create_at = Column(DateTime(timezone=True), server_default=func.now())
    update_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RemoteCommandAuditModel(Base):
    """Sanitized command execution audit for a learning session."""

    __tablename__ = "remote_command_audits"

    audit_id = Column(String, primary_key=True, index=True)
    session_id = Column(
        String,
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    owner_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    binding_id = Column(
        String,
        ForeignKey("session_remote_bindings.binding_id", ondelete="SET NULL"),
        nullable=True,
    )
    action = Column(String, nullable=False)
    command = Column(Text, nullable=True)
    cwd = Column(String, nullable=True)
    exit_code = Column(Integer, nullable=True)
    stdout_excerpt = Column(Text, nullable=True)
    stderr_excerpt = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    redaction_applied = Column(String, nullable=False, default="true")
    create_at = Column(DateTime(timezone=True), server_default=func.now())
