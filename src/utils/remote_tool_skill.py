"""LangChain skill wrapper for Remote Runner environment observation."""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.tools import tool

from utils.remote_runner_provider import (
    RemoteRunnerProvider,
    get_remote_runner_provider,
)

logger = logging.getLogger(__name__)


class RemoteEnvironmentSkill:
    """Expose permissioned remote lab observation as a Tutor tool."""

    name = "observe_remote_environment"
    description = (
        "Observe the student's configured lab environment through Remote Runner. "
        "Use only when the student's current machine state, shell output, files, "
        "or diagnostic context are needed to guide them. Supported actions are "
        "list_machines, list_sessions, machine_doctor, and session_exec. "
        "session_exec is restricted to configured safe commands."
    )

    def __init__(self, provider: RemoteRunnerProvider) -> None:
        self.provider = provider

    def get_tool(self):
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def observe_remote_environment(
            action: str,
            machine_id: str = "",
            session_id: str = "",
            command: str = "",
            cwd: str = "",
            reason: str = "",
        ) -> str:
            """Observe the configured remote lab environment.

            Args:
                action: One of list_machines, list_sessions, machine_doctor,
                    or session_exec.
                machine_id: Machine id for machine_doctor or policy checks.
                session_id: Existing Remote Runner session id for session_exec.
                command: Safe diagnostic command for session_exec.
                cwd: Optional cwd override, subject to configured prefixes.
                reason: Short reason this observation helps the tutoring step.

            Returns:
                Sanitized Remote Runner JSON result or a safe error payload.
            """
            return self.provider.observe(
                action=action,
                machine_id=machine_id,
                session_id=session_id,
                command=command,
                cwd=cwd,
                reason=reason,
            )

        observe_remote_environment.name = tool_name
        observe_remote_environment.description = tool_description
        return observe_remote_environment


def get_remote_environment_skill(
    provider: Optional[RemoteRunnerProvider] = None,
) -> Optional[RemoteEnvironmentSkill]:
    """Return the remote skill only when the feature is enabled."""
    provider = provider or get_remote_runner_provider()
    if not provider.enabled:
        logger.info("Remote environment skill disabled: %s", provider.status)
        return None
    return RemoteEnvironmentSkill(provider)
