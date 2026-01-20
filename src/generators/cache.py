"""Cache module for generator intermediate results.

This module provides caching functionality for technical analysis and dependency maps,
reducing API costs and improving response times for repeated generation requests.
"""

import hashlib
import logging
import threading
from typing import Any, Dict, Optional

from schemas.generator_intermediate import DependencyMap, TechnicalAnalysis

logger = logging.getLogger(__name__)


class GeneratorCache:
    """In-memory cache for generator intermediate results.

    Thread-safe cache implementation using dictionary and locks.
    Caches technical analysis results and dependency maps based on content hash.
    """

    def __init__(self, max_size: int = 100):
        """Initialize GeneratorCache.

        Args:
            max_size: Maximum number of cached entries. Defaults to 100.
        """
        self._cache: Dict[str, Any] = {}
        self._lock = threading.Lock()
        self._max_size = max_size
        logger.info("GeneratorCache initialized (max_size=%d)", max_size)

    def _get_cache_key(self, content: str, cache_type: str) -> str:
        """Generate cache key from content hash and cache type.

        Args:
            content: The content to hash.
            cache_type: Type of cache entry (e.g., 'technical_analysis', 'dependency_map').

        Returns:
            Cache key string.
        """
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        return f"{cache_type}:{content_hash}"

    def _evict_oldest(self) -> None:
        """Evict oldest entry when cache is full.

        Uses simple FIFO strategy by removing first entry.
        """
        if self._cache:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            logger.debug("Evicted cache entry: %s", oldest_key)

    def get_technical_analysis(
        self, lab_manual_content: str
    ) -> Optional[TechnicalAnalysis]:
        """Get cached technical analysis result.

        Args:
            lab_manual_content: The lab manual content.

        Returns:
            Cached TechnicalAnalysis if found, None otherwise.
        """
        cache_key = self._get_cache_key(lab_manual_content, "technical_analysis")
        with self._lock:
            if cache_key in self._cache:
                logger.info("Cache hit for technical analysis: %s", cache_key[:16])
                return self._cache[cache_key]
            logger.debug("Cache miss for technical analysis: %s", cache_key[:16])
            return None

    def set_technical_analysis(
        self, lab_manual_content: str, technical_analysis: TechnicalAnalysis
    ) -> None:
        """Cache technical analysis result.

        Args:
            lab_manual_content: The lab manual content.
            technical_analysis: The TechnicalAnalysis object to cache.
        """
        cache_key = self._get_cache_key(lab_manual_content, "technical_analysis")
        with self._lock:
            if len(self._cache) >= self._max_size:
                self._evict_oldest()
            self._cache[cache_key] = technical_analysis
            logger.debug("Cached technical analysis: %s", cache_key[:16])

    def get_dependency_map(
        self, lab_manual_content: str
    ) -> Optional[DependencyMap]:
        """Get cached dependency map result.

        Args:
            lab_manual_content: The lab manual content.

        Returns:
            Cached DependencyMap if found, None otherwise.
        """
        cache_key = self._get_cache_key(lab_manual_content, "dependency_map")
        with self._lock:
            if cache_key in self._cache:
                logger.info("Cache hit for dependency map: %s", cache_key[:16])
                return self._cache[cache_key]
            logger.debug("Cache miss for dependency map: %s", cache_key[:16])
            return None

    def set_dependency_map(
        self, lab_manual_content: str, dependency_map: DependencyMap
    ) -> None:
        """Cache dependency map result.

        Args:
            lab_manual_content: The lab manual content.
            dependency_map: The DependencyMap object to cache.
        """
        cache_key = self._get_cache_key(lab_manual_content, "dependency_map")
        with self._lock:
            if len(self._cache) >= self._max_size:
                self._evict_oldest()
            self._cache[cache_key] = dependency_map
            logger.debug("Cached dependency map: %s", cache_key[:16])

    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info("Cache cleared (%d entries removed)", count)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache statistics.
        """
        with self._lock:
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "keys": list(self._cache.keys())[:10],  # First 10 keys for debugging
            }


# Global cache instance (shared across all generators)
_global_cache: Optional[GeneratorCache] = None
_cache_lock = threading.Lock()


def get_cache() -> GeneratorCache:
    """Get global cache instance (singleton pattern).

    Returns:
        Global GeneratorCache instance.
    """
    global _global_cache
    if _global_cache is None:
        with _cache_lock:
            if _global_cache is None:
                _global_cache = GeneratorCache()
    return _global_cache
