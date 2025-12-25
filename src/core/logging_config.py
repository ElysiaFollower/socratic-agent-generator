"""Logging configuration module.

This module provides centralized logging configuration following Google Python
Style Guide and best practices.
"""

import logging
import sys
from pathlib import Path
from typing import Optional


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[Path] = None,
    format_string: Optional[str] = None,
) -> None:
    """Configure application-wide logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
            Defaults to INFO.
        log_file: Optional path to log file. If None, logs only to console.
        format_string: Optional custom format string. If None, uses default
            format.

    Example:
        >>> setup_logging(log_level="DEBUG")
        >>> logger = logging.getLogger(__name__)
        >>> logger.info("Application started")
    """
    if format_string is None:
        format_string = (
            "%(asctime)s - %(name)s - %(levelname)s - "
            "%(filename)s:%(lineno)d - %(message)s"
        )

    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        handlers.append(file_handler)

    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=format_string,
        handlers=handlers,
        force=True,
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for the given module name.

    Args:
        name: Module name, typically __name__.

    Returns:
        Configured logger instance.

    Example:
        >>> logger = get_logger(__name__)
        >>> logger.info("Module initialized")
    """
    return logging.getLogger(name)

