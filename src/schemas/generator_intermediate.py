"""Intermediate data structures for multi-stage generators.

This module defines intermediate schemas used in the three-stage generation process
for PersonaGenerator and CurriculumGenerator, supporting the "creative empowerment"
core value: transforming static documents into living tutor profiles.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# ============================================================================
# PersonaGenerator Intermediate Schemas
# ============================================================================

class TechnicalAnalysis(BaseModel):
    """Technical analysis report - Stage 1 output for PersonaGenerator.
    
    This represents the objective technical analysis of a lab manual,
    stripped of emotional elements, ready for creative persona synthesis.
    """
    knowledge_density: Dict[str, Any] = Field(
        description="Knowledge density assessment: core concepts involved and their hierarchy"
    )
    target_audience_profile: str = Field(
        description="Target audience profile: inferred student baseline competency requirements"
    )
    hard_constraints: List[str] = Field(
        description="Hard constraints: legal, ethical, and safety bottom lines"
    )


class CriticScore(BaseModel):
    """Critic score result - Stage 3 output for PersonaGenerator.
    
    This represents the quality assessment of the generated persona,
    ensuring it aligns with Socratic teaching principles.
    """
    overall_score: int = Field(
        ge=1, le=10,
        description="Overall score (1-10), where 8+ is acceptable"
    )
    adaptability_score: int = Field(
        ge=1, le=10,
        description="Adaptability score: does the persona conflict with the lab's seriousness?"
    )
    safety_score: int = Field(
        ge=1, le=10,
        description="Safety score: are constraint conditions complete enough?"
    )
    executability_score: int = Field(
        ge=1, le=10,
        description="Executability score: will the persona cause LLM to forget teaching tasks?"
    )
    socratic_alignment_score: int = Field(
        ge=1, le=10,
        description="Socratic alignment score: will the persona maintain Socratic principles?"
    )
    suggestions: List[str] = Field(
        default=[],
        description="List of modification suggestions"
    )
    critical_issues: List[str] = Field(
        default=[],
        description="List of critical issues (if any)"
    )


# ============================================================================
# CurriculumGenerator Intermediate Schemas
# ============================================================================

class AtomicTask(BaseModel):
    """Atomic task - the smallest executable operational unit.
    
    This represents a single task with its dependencies and verifiable evidence,
    forming the building blocks of the dependency map.
    """
    task_id: str = Field(
        description="Unique identifier for the task"
    )
    task_title: str = Field(
        description="Task title"
    )
    objective: str = Field(
        description="Core learning objective for this task"
    )
    prerequisites: List[str] = Field(
        default=[],
        description="Prerequisite task IDs or concepts that students must master before starting"
    )
    verifiable_evidence: Optional[str] = Field(
        default=None,
        description="How to prove the task is completed through console output or file changes"
    )
    key_elements: List[str] = Field(
        description="Key technical elements involved: commands, functions, or concepts"
    )


class DependencyMap(BaseModel):
    """Dependency map - Stage 1 output for CurriculumGenerator.
    
    This represents the structured technical analysis with explicit dependency relationships,
    ready for Socratic pedagogical transformation.
    """
    overall_goal: str = Field(
        description="Overall goal of the entire lab"
    )
    atomic_tasks: List[AtomicTask] = Field(
        description="List of atomic tasks in order"
    )
    dependency_graph: Dict[str, List[str]] = Field(
        default={},
        description="Dependency graph: task_id -> list of dependent task IDs (optional, for explicit representation)"
    )


class CurriculumCriticResult(BaseModel):
    """Curriculum critic result - Stage 3 output for CurriculumGenerator.
    
    This represents the quality assessment of the generated curriculum,
    ensuring it maintains Socratic teaching principles.
    """
    overall_score: int = Field(
        ge=1, le=10,
        description="Overall score (1-10), where 8+ is acceptable"
    )
    answer_leak_score: int = Field(
        ge=1, le=10,
        description="Answer leak check score: do guiding questions contain operational instructions? (higher is better)"
    )
    difficulty_gradient_score: int = Field(
        ge=1, le=10,
        description="Difficulty gradient score: is the gap between steps too large? (higher is better)"
    )
    verifiability_score: int = Field(
        ge=1, le=10,
        description="Verifiability score: can success criteria be determined through student response? (higher is better)"
    )
    issues: List[str] = Field(
        default=[],
        description="List of identified issues"
    )
    suggestions: List[str] = Field(
        default=[],
        description="List of modification suggestions"
    )
    critical_issues: List[str] = Field(
        default=[],
        description="List of critical issues (if any)"
    )
