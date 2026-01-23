"""Step evaluator module.

This module provides the StepEvaluator class for evaluating student progress
against learning step success criteria.
"""

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from config import (
    EVALUATION_FALLBACK_THRESHOLD,
    EVALUATION_PASS_THRESHOLD,
    EVALUATION_TEMPERATURE,
)

logger = logging.getLogger(__name__)

# Evaluation prompt template
EVALUATION_PROMPT_TEMPLATE = """You are an educational assessment expert. Your task is to evaluate whether a student meets the success criteria for the current learning step.

## Task Objective
Evaluate whether the student meets the success criteria. Output a floating-point number between 0 and 1 (with 2 decimal places) representing your confidence that the student meets the criteria.

## Current Step Information
Step Title: {step_title}
Learning Objective: {learning_objective}
Success Criteria: {success_criteria}

## Conversation Context
<conversation_context>
{conversation_context}
</conversation_context>

## Student's Latest Response
<student_response>
{user_input}
</student_response>

## Evaluation Criteria
Please consider the following factors comprehensively:
1. Whether the student clearly understands the core concepts
2. Whether the student's response is accurate and complete
3. Whether the student demonstrates progressive understanding across multiple conversation turns
4. Whether the student has met the requirements of the success criteria

## Output Requirements
Output only a floating-point number between 0 and 1 (with 2 decimal places) representing your confidence that the student meets the success criteria.

Pass Threshold: {pass_threshold} (A confidence score >= {pass_threshold} indicates the student meets the criteria)

Do not output any other content. Output only the number.
"""


@dataclass
class EvaluationResult:
    """Evaluation result data structure.

    Attributes:
        confidence: Confidence score (0.0-1.0) indicating how well the student
            meets the success criteria.
    """

    confidence: float

    @property
    def passed(self) -> bool:
        """Check if the evaluation passed based on threshold.

        Returns:
            True if confidence >= EVALUATION_PASS_THRESHOLD, False otherwise.
        """
        return self.confidence >= EVALUATION_PASS_THRESHOLD


class StepEvaluator:
    """Independent step evaluator for assessing student progress.

    This evaluator uses a separate LLM call to evaluate whether a student
    meets the success criteria for the current learning step. It considers
    multi-turn conversation context for progressive understanding assessment.
    """

    def __init__(self, llm: Optional[Any] = None):
        """Initialize the evaluator.

        Args:
            llm: LLM instance (DeepSeek Chat). If None, uses default evaluator LLM.
        """
        self.llm = llm or self._get_evaluator_llm()

    def _get_evaluator_llm(self) -> Any:
        """Get evaluator LLM instance.

        Note: Evaluator uses DeepSeek Chat (same as main LLM) but with low
        temperature for evaluation consistency.

        Returns:
            ChatDeepSeek instance configured for evaluation.
        """
        from langchain_deepseek import ChatDeepSeek

        return ChatDeepSeek(
            model="deepseek-chat",
            temperature=EVALUATION_TEMPERATURE,
        )

    async def evaluate(
        self,
        step_info: Dict[str, Any],
        conversation_context: List[Dict[str, str]],
        user_input: str,
    ) -> EvaluationResult:
        """Evaluate whether student meets success criteria.

        Args:
            step_info: Current step information (contains success_criteria, etc.).
            conversation_context: Conversation context (multi-turn dialogue from
                step start).
            user_input: Latest user input.

        Returns:
            EvaluationResult object (contains confidence, passed property based
            on threshold).
        """
        # Build evaluation prompt
        prompt = self._build_evaluation_prompt(
            step_info, conversation_context, user_input
        )

        # Call LLM (async)
        try:
            response = await self.llm.ainvoke(prompt)
            # Extract content from AIMessage (LangChain returns AIMessage object)
            content = response.content if hasattr(response, "content") else str(response)
            confidence = self._parse_evaluation_result(content)
            return EvaluationResult(confidence=confidence)
        except Exception as e:
            logger.error("Evaluator call failed: %s", e, exc_info=True)
            # Return conservative result (confidence=0, not passed)
            return EvaluationResult(confidence=0.0)

    def _build_evaluation_prompt(
        self,
        step_info: Dict[str, Any],
        conversation_context: List[Dict[str, str]],
        user_input: str,
    ) -> str:
        """Build evaluation prompt.

        Args:
            step_info: Current step information.
            conversation_context: Conversation context.
            user_input: Latest user input.

        Returns:
            Formatted evaluation prompt string.
        """
        # Format conversation context
        context_str = self._format_conversation_context(conversation_context)

        # Build prompt using template
        prompt = EVALUATION_PROMPT_TEMPLATE.format(
            step_title=step_info["step_title"],
            learning_objective=step_info["learning_objective"],
            success_criteria=step_info["success_criteria"],
            conversation_context=context_str,
            user_input=user_input,
            pass_threshold=EVALUATION_PASS_THRESHOLD,
        )
        return prompt

    def _format_conversation_context(
        self, context: List[Dict[str, str]]
    ) -> str:
        """Format conversation context for prompt.

        Args:
            context: List of conversation messages with role and content.

        Returns:
            Formatted context string. Returns empty string if context is empty.
        """
        if not context:
            return "(No conversation context available)"

        formatted = []
        for msg in context:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            role_display = "Student" if role == "user" else "Tutor"
            formatted.append(f"{role_display}: {content}")
        return "\n".join(formatted)

    def _parse_evaluation_result(self, response: str) -> float:
        """Parse evaluation result, extract float between 0-1.

        Args:
            response: Raw LLM output.

        Returns:
            Confidence score (0.0-1.0).
        """
        # Try to extract float (0.00-1.00 format)
        # Pattern: 0.00 to 1.00 with up to 2 decimal places
        float_pattern = r"\b(0\.\d{1,2}|1\.00|1\.0)\b"
        matches = re.findall(float_pattern, response)

        if matches:
            try:
                confidence = float(matches[0])
                # Ensure in 0-1 range
                confidence = max(0.0, min(1.0, confidence))
                return round(confidence, 2)  # Round to 2 decimal places
            except ValueError:
                logger.warning("Failed to parse float: %s", matches[0])

        # Fallback: try to extract any number
        number_pattern = r"\b(\d+\.?\d*)\b"
        number_matches = re.findall(number_pattern, response)
        if number_matches:
            try:
                num = float(number_matches[0])
                # If number > 1, might be percentage, divide by 100
                if num > 1:
                    num = num / 100.0
                confidence = max(0.0, min(1.0, num))
                return round(confidence, 2)
            except ValueError:
                pass

        # If completely unable to parse, return 0.0 (conservative strategy)
        logger.warning(
            "Unable to parse evaluation result, returning default 0.0. "
            "Original output: %s",
            response,
        )
        return 0.0
