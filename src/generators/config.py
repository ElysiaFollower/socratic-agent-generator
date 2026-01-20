"""Generator configuration module.

This module defines configuration options for PersonaGenerator and CurriculumGenerator,
supporting flexible quality-cost trade-offs while maintaining the core value of
"creative empowerment" (transforming static documents into living tutor profiles).
"""

from dataclasses import dataclass


@dataclass
class GeneratorConfig:
    """Unified generator configuration for PersonaGenerator and CurriculumGenerator.
    
    This configuration allows balancing quality, cost, and latency while ensuring
    the core value of "creative empowerment" is maintained.
    """
    # Three-stage design switch
    use_three_stage: bool = True  # Whether to use three-stage design (default: enabled)
    
    # Quality assurance switches
    enable_critic: bool = True  # Whether to enable critic (default: enabled)
    enable_loop: bool = False  # Whether to enable loop optimization (default: disabled)
    critic_threshold: int = 8  # Critic score threshold (8+ is acceptable)
    
    # Performance optimization
    enable_cache: bool = True  # Whether to enable caching (default: enabled)
    max_iterations: int = 3  # Maximum loop iterations
    
    # Routing strategy
    use_simple_mode_for_simple_tasks: bool = True  # Use single-stage for simple tasks


# Predefined configurations for common scenarios

PRODUCTION_CONFIG = GeneratorConfig(
    use_three_stage=True,
    enable_critic=True,
    enable_loop=False,  # Loop disabled by default
    enable_cache=True
)

HIGH_QUALITY_CONFIG = GeneratorConfig(
    use_three_stage=True,
    enable_critic=True,
    enable_loop=True,  # Loop enabled for high quality
    critic_threshold=9,  # Higher threshold
    enable_cache=True
)

FAST_CONFIG = GeneratorConfig(
    use_three_stage=False,  # Use single-stage
    enable_critic=False,
    enable_cache=True
)
