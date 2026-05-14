from schemas.curriculum import SocraticCurriculum, SocraticStep
from utils.template_assembler import PromptAssembler
from utils.tutor_core import _agent_executor_kwargs, _looks_like_tool_only_reply


def test_agent_executor_uses_force_early_stopping():
    kwargs = _agent_executor_kwargs()

    assert kwargs["early_stopping_method"] == "force"
    assert kwargs["handle_parsing_errors"] is True
    assert kwargs["max_iterations"] >= 1


def test_runtime_prompt_adds_tool_teaching_contract_to_existing_profiles():
    assembler = PromptAssembler(
        "Tutor template.\n"
        "Current: {{current_step.step_title}} / {{output_language}} / {{skills_summary}}"
    )
    curriculum = SocraticCurriculum(
        root=[
            SocraticStep(
                step_title="Interface baseline",
                guiding_question="Why check the interface first?",
                success_criteria="Student explains root and interface evidence.",
                learning_objective="Build a baseline.",
            )
        ]
    )

    prompt = assembler.assemble(curriculum, 0, "English", skills=[])

    assert "### Runtime Interaction Contract" in prompt
    assert "Every turn must end with a clear teaching response" in prompt
    assert "Do not keep inventorying the environment" in prompt


def test_tool_only_reply_detection_catches_remote_probe_preamble():
    reply = (
        "Let me check the lab environment first so we have concrete facts to work with."
        "Let me check who we are and see if Docker containers are running."
    )

    assert _looks_like_tool_only_reply(reply, tool_call_count=3)
    assert not _looks_like_tool_only_reply(
        "The bridge interface matters because it is where container traffic crosses. "
        "Why would sniffing the wrong interface show no packets?",
        tool_call_count=1,
    )
