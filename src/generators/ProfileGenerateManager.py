import dotenv
dotenv.load_dotenv()

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
import config
from generators.CurriculumGenerator import CurriculumGenerator
from agents.persona_agent import PersonaAgent
from utils.TemplateAssembler import BaseTemplateAssembler
from schemas.profile import Profile
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona

from typing import Dict, List, Optional, Any
import json
import asyncio


class ProfileGenerateManager:
    """
    manage the process of how a profile is generated.
    the generated profile will be named with a unique id (by uuid4())
    """
    def __init__(self, llm: Optional[Any] = None):
        """init

        Args:
            llm (Any): if not given, use default value - example: langchain_deepseek.ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE)
        """
        self.output_dir = config.PROFILES_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.llm = llm or config.get_default_llm()
        
        self.curriculum_generator = CurriculumGenerator(self.llm)
        self.persona_agent = PersonaAgent(self.llm)
        with open(config.PROMPT_TEMPLATE_DIR / 'master_prompt_system.jinja2') as f:
            self.promt_template_string = f.read()
        self.template_assembler = BaseTemplateAssembler(self.promt_template_string)
        
    async def generate_curriculum(self, lab_manual_content: str)->SocraticCurriculum:
        """generate curriculum by referencing lab manual

        Returns:
            List[Dict[str, str]]: list of steps
        """
        curriculum = await self.curriculum_generator.generate(lab_manual_content)
        return curriculum

    async def generate_persona(self, lab_manual_content: str)->TutorPersona:
        """generate persona by referencing lab manual

        Returns:
            Dict[str, str]: persona
        """
        persona = await self.persona_agent.generate(lab_manual_content)
        return persona
    
    async def compile_profile(self, curriculum: SocraticCurriculum, definition: TutorPersona, profile_name: Optional[str]=None) -> Profile:
        """compile the profile and save it to disk
        curriculum and definition is readable and can be modified by user
        but profile is not readable and not designed to be modified

        Args:
            curriculum (SocraticCurriculum): The curriculum to use.
            definition (TutorPersona): The persona to use.
            profile_name (Optional[str], optional): profile name. Defaults: topic_name.

        Returns:
            Profile: The compiled profile.
        """
        assert curriculum is not None
        assert definition is not None
        
        # assemble prompt
        base_template = self.template_assembler.assemble(definition, curriculum)
        
        # generate profile
        profile = self._assemble_profile(curriculum, definition, base_template, profile_name)
        
        # save
        self._save_profile(profile)

        return profile
    
    def _assemble_profile(self, curriculum: SocraticCurriculum, definition: TutorPersona, base_template: str, profile_name: Optional[str]) -> Profile:
        """
        define the structure of profile
        """
        # use topic_name as its default(init) value
        # profile_id is auto generated
        return Profile(
            profile_name=profile_name,
            topic_name=definition.get_topic_name(),
            persona_hints=definition.get_persona_hints(),
            target_audience=definition.get_target_audience(),
            curriculum=curriculum,
            prompt_template=base_template
        )
    
    def _save_profile(self, profile: Profile) -> None:
        """save profile to disk

        Args:
            profile (Dict[str, Any]): profile
        """
        profile_id = profile.get("profile_id", None)
        if profile_id is None:
            raise ValueError("profile_id is required")
        output_path = self.output_dir / f"{profile_id}.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(profile.model_dump(), f, ensure_ascii=False, indent=2)
        
        print(f"Profile saved to {output_path}")

        
        
if __name__ == "__main__":
    # example usage
    async def main():
        with open(config.ROOT_DIR / "data_raw/Spectre-Attack/lab_manual.md", "r", encoding="utf-8") as f:
            lab_manual_content = f.read()
        profile_manager = ProfileGenerateManager()
        curriculum, definition = await asyncio.gather(
            profile_manager.generate_curriculum(lab_manual_content),
            profile_manager.generate_persona(lab_manual_content)
        )
        await profile_manager.compile_profile(curriculum, definition)

    asyncio.run(main())
        
            
        
        
