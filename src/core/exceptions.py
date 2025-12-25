"""Custom exception classes for the Socratic Agent Generator.

This module defines application-specific exceptions following Google Python
Style Guide.
"""


class SocraticAgentError(Exception):
    """Base exception for all Socratic Agent Generator errors."""

    pass


class ProfileNotFoundError(SocraticAgentError):
    """Raised when a requested profile cannot be found."""

    def __init__(self, profile_id: str):
        """Initialize the exception.

        Args:
            profile_id: The ID of the profile that was not found.
        """
        self.profile_id = profile_id
        super().__init__(f"Profile '{profile_id}' not found")


class SessionNotFoundError(SocraticAgentError):
    """Raised when a requested session cannot be found."""

    def __init__(self, session_id: str):
        """Initialize the exception.

        Args:
            session_id: The ID of the session that was not found.
        """
        self.session_id = session_id
        super().__init__(f"Session '{session_id}' not found")


class ConfigurationError(SocraticAgentError):
    """Raised when there is a configuration error."""

    pass


class LLMError(SocraticAgentError):
    """Raised when there is an error communicating with the LLM."""

    pass


class ValidationError(SocraticAgentError):
    """Raised when data validation fails."""

    pass

