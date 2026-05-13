from utils.tutor_core import _agent_executor_kwargs


def test_agent_executor_uses_generate_early_stopping():
    kwargs = _agent_executor_kwargs()

    assert kwargs["early_stopping_method"] == "generate"
    assert kwargs["handle_parsing_errors"] is True
    assert kwargs["max_iterations"] >= 5
