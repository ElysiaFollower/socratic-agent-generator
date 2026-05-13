from utils.skills import BaseSkill


def test_base_skill_name_falls_back_to_directory_name_when_metadata_missing():
    skill = BaseSkill("lab_manual")
    skill.metadata = {}

    assert skill.name == "lab_manual"


def test_base_skill_name_strips_metadata_value():
    skill = BaseSkill("pedagogy")
    skill.metadata = {"name": "  custom_tool  "}

    assert skill.name == "custom_tool"
