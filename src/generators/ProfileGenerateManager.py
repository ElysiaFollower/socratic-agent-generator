"""Profile generation management module.

This module manages the process of generating tutor profiles from lab manuals.
The generated profile will be named with a unique id (by uuid4()).
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import dotenv
from pathlib import Path

dotenv.load_dotenv()

from config import PROFILES_DIR, PROMPT_TEMPLATE_DIR, get_default_llm
from generators.CurriculumGenerator import CurriculumGenerator
from generators.PersonaGenerator import PersonaGenerator
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona
from schemas.profile import Profile
from utils.template_assembler import BaseTemplateAssembler

logger = logging.getLogger(__name__)


class ProfileGenerateManager:
    """Manages the process of generating tutor profiles.

    This class coordinates the generation of curriculum, persona, and final
    profile from a lab manual. The generated profile will be named with a
    unique id (by uuid4()).
    """

    def __init__(self, lab_manual_content: str, llm: Optional[Any] = None):
        """Initialize ProfileGenerateManager.

        Args:
            lab_manual_content: The content of the lab manual (required).
            llm: Optional LLM instance. If None, uses default LLM from config.
        """
        self.lab_manual_content = lab_manual_content
        self.output_dir = PROFILES_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.llm = llm or get_default_llm()

        self.curriculum_generator = CurriculumGenerator(self.llm)
        self.persona_generator = PersonaGenerator(self.llm)
        with open(PROMPT_TEMPLATE_DIR / "master_prompt_system.jinja2", encoding="utf-8") as f:
            self.prompt_template_string = f.read()
        self.template_assembler = BaseTemplateAssembler(self.prompt_template_string)
    def change_lab_manual_content(self, lab_manual_content: str) -> None:
        """Change the lab manual this manager references.

        Args:
            lab_manual_content: Content of lab manual.
        """
        self.lab_manual_content = lab_manual_content

    async def generate_curriculum(self) -> SocraticCurriculum:
        """Generate curriculum by referencing lab manual.

        Returns:
            SocraticCurriculum object containing the generated curriculum.
        """
        curriculum = await self.curriculum_generator.generate(self.lab_manual_content)
        return curriculum

    async def generate_persona(self) -> TutorPersona:
        """Generate persona by referencing lab manual.

        Returns:
            TutorPersona object containing the generated persona.
        """
        persona = await self.persona_generator.generate(self.lab_manual_content)
        return persona
    
    async def compile_profile(
        self,
        curriculum: Optional[SocraticCurriculum] = None,
        definition: Optional[TutorPersona] = None,
        profile_name: Optional[str] = None,
        lab_name: Optional[str] = None,
        output_dir: Optional[Path] = None,
    ) -> Profile:
        """Compile the profile.

        Args:
            curriculum: Reviewed curriculum. If None, auto-generated.
            definition: Reviewed definition. If None, auto-generated.
            profile_name: Profile name. If None, defaults to topic_name.
            output_dir: Optional custom output directory. If provided, saves to JSON file.
                        If None, DOES NOT save to file.

        Returns:
            The generated Profile object.
        """
        if curriculum is None and definition is None:
            curriculum, definition = await asyncio.gather(
                self.generate_curriculum(),
                self.generate_persona()
            )
        else:
            curriculum = curriculum or await self.generate_curriculum()
            definition = definition or await self.generate_persona()
        assert curriculum is not None
        assert definition is not None
        
        # assemble prompt
        base_template = self.template_assembler.assemble(definition, curriculum)
        
        # generate profile
        profile = self._assemble_profile(
            curriculum,
            definition,
            base_template,
            profile_name,
            lab_name,
        )
        
        # save only if output_dir is provided (Backwards compatibility for JSON file usage)
        if output_dir:
            self._save_profile(profile, output_dir=output_dir)
        
        return profile
    
    def _assemble_profile(
        self,
        curriculum: SocraticCurriculum,
        definition: TutorPersona,
        base_template: str,
        profile_name: Optional[str],
        lab_name: Optional[str],
    ) -> Profile:
        """Assemble profile structure."""
        return Profile(
            profile_name=profile_name,
            topic_name=definition.get_topic_name(),
            lab_name=lab_name,
            persona_hints=definition.get_persona_hints(),
            target_audience=definition.get_target_audience(),
            curriculum=curriculum,
            prompt_template=base_template,
        )

    def _save_profile(self, profile: Profile, output_dir: Optional[Path] = None) -> None:
        """Save profile to disk (JSON)."""
        output_dir = output_dir or self.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        
        profile_id = profile.profile_id
        output_path = output_dir / f"{profile_id}.json"

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(profile.model_dump(), f, ensure_ascii=False, indent=2)

        logger.info("Profile saved to %s", output_path)

if __name__ == "__main__":
    # Debug/example usage
    import config

    async def main():
        # This debug script still uses file saving logic if path is provided
        try:
            with open(
                config.ROOT_DIR / "data_raw/Spectre-Attack/lab_manual.md",
                "r",
                encoding="utf-8",
            ) as f:
                lab_manual_content = f.read()
            profile_manager = ProfileGenerateManager(lab_manual_content)
            curriculum, definition = await asyncio.gather(
                profile_manager.generate_curriculum(),
                profile_manager.generate_persona(),
            )
            await profile_manager.compile_profile(
                curriculum=curriculum,
                definition=definition,
                lab_name="Spectre-Attack",
                output_dir=config.PROFILES_DIR # Pass dir to save
            )
        except Exception as e:
            print(f"Error: {e}")

    asyncio.run(main())
