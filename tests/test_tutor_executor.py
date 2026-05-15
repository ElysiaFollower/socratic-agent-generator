from schemas.curriculum import SocraticCurriculum, SocraticStep
from utils.template_assembler import PromptAssembler
from utils.tutor_core import (
    Tutor,
    _agent_executor_kwargs,
    _looks_like_tool_only_reply,
    _missing_stream_reply_chunk,
    _summarize_remote_observations,
)


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
    assert "Prefer one clear remote command per tool call" in prompt
    assert "instead of compound shell expressions" in prompt
    assert "Retry with a smaller, policy-compliant single command" in prompt


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


def test_missing_stream_reply_chunk_returns_unstreamed_suffix():
    assert _missing_stream_reply_chunk("hello world", "hello ") == "world"
    assert _missing_stream_reply_chunk("hello world", "hello world") == ""
    assert _missing_stream_reply_chunk("teaching summary", "") == "teaching summary"
    assert (
        _missing_stream_reply_chunk("final teaching summary", "tool preamble")
        == "\n\nfinal teaching summary"
    )


def test_remote_observation_summary_hides_raw_json():
    summary = _summarize_remote_observations(
        [
            '{"action":"machine_doctor","ok":true,"result":{"reachable":true,'
            '"auth_ok":true,"default_cwd_ok":true}}',
            '{"action":"session_exec","ok":false,'
            '"error":"Command is not allowed by Remote Runner command policy."}',
        ]
    )

    assert "machine_doctor:" in summary
    assert "reachable=True" in summary
    assert "session_exec: failed" in summary
    assert "{" not in summary
    assert "Relevant evidence" not in summary


def test_extract_step_context_keeps_recent_messages_under_token_budget():
    from langchain_community.chat_message_histories import ChatMessageHistory
    from langchain_core.messages import AIMessage, HumanMessage

    tutor = Tutor.__new__(Tutor)
    tutor.llm = type(
        "FakeLLM",
        (),
        {"get_num_tokens": staticmethod(lambda text: len(text.split()))},
    )()
    history = ChatMessageHistory()
    history.add_message(HumanMessage(content="old filler " * 60))
    history.add_message(AIMessage(content="old tutor response " * 60))
    history.add_message(HumanMessage(content="current step evidence includes BPF filter"))
    history.add_message(AIMessage(content="current tutor follow-up"))
    tutor.history = history

    context = tutor.extract_step_context(max_tokens=20)
    combined = "\n".join(item["content"] for item in context)

    assert "current step evidence includes BPF filter" in combined
    assert "old filler" not in combined
