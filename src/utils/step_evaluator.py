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
EVALUATION_PROMPT_TEMPLATE = """你是一个教学评估专家。你的任务是评估学生是否满足当前学习步骤的成功标准。

## 任务目标
评估学生是否满足成功标准，输出一个0-1之间的浮点数（保留两位小数），表示学生满足标准的置信度。

## 当前步骤信息
步骤标题：{step_title}
学习目标：{learning_objective}
成功标准：{success_criteria}

## 对话上下文
{conversation_context}

## 学生最新回答
{user_input}

## 评估标准
请综合考虑以下因素：
1. 学生是否明确理解了核心概念
2. 学生的回答是否准确且完整
3. 在多轮对话中，学生是否表现出渐进式理解
4. 学生是否达到了成功标准的要求

## 输出要求
只输出一个0-1之间的浮点数（保留两位小数），表示学生满足成功标准的置信度。

通过阈值：{pass_threshold}（置信度 >= {pass_threshold} 时判定为满足标准）

不要输出任何其他内容，只输出数字。
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
            return "（暂无对话上下文）"

        formatted = []
        for msg in context:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            role_display = "学生" if role == "user" else "导师"
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
