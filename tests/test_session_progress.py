from schemas.curriculum import SocraticCurriculum, SocraticStep
from schemas.profile import Profile
from schemas.session import Session, SessionState


def _session_at(step_index: int) -> Session:
    curriculum = SocraticCurriculum(
        root=[
            SocraticStep(step_title="one"),
            SocraticStep(step_title="two"),
        ]
    )
    profile = Profile(
        profile_name="progress",
        topic_name="Progress",
        persona_hints=[],
        target_audience="students",
        curriculum=curriculum,
        prompt_template="prompt",
    )
    return Session(profile=profile, state=SessionState(stepIndex=step_index))


def test_session_is_finished_when_step_index_reaches_total_steps():
    assert not _session_at(0).is_finished()
    assert not _session_at(1).is_finished()
    assert _session_at(2).is_finished()
    assert _session_at(3).is_finished()
