import dotenv
dotenv.load_dotenv()

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
import config
from generators.CurriculumGenerator import CurriculumGenerator
from generators.PersonaGenerator import PersonaGenerator
from utils.TemplateAssembler import BaseTemplateAssembler

from typing import Dict, List, Optional, Any
import uuid
import json
import asyncio


class ProfileGenerateManager:
    """
    manage the process of how a profile is generated.
    the generated profile will be named with a unique id (by uuid4())
    """
    def __init__(self, lab_manual_content: str, llm: Optional[Any] = None):
        """init

        Args:
            lab_manual_content (str): must given, the manaul of the lab
            llm (Any): if not given, use default value - example: langchain_deepseek.ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE)
        """
        self.lab_manual_content = lab_manual_content
        self.output_dir = config.PROFILES_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.llm = llm or config.get_default_llm()
        
        self.curriculum_generator = CurriculumGenerator(self.llm)
        self.persona_generator = PersonaGenerator(self.llm)
        with open(config.PROMPT_TEMPLATE_DIR / 'master_prompt_system.jinja2') as f:
            self.promt_template_string = f.read()
        self.template_assembler = BaseTemplateAssembler(self.promt_template_string)
    def change_lab_manual_content(self, lab_manual_content: str):
        """change the lab manual this manager references

        Args:
            lab_manual_content (str): content of lab manual
        """
        self.lab_manual_content = lab_manual_content
        
    async def generate_curriculum(self)->List[Dict[str, Any]]:
        """generate curriculum by referencing lab manual

        Returns:
            List[Dict[str, str]]: list of steps
        """
        curriculum = await self.curriculum_generator.generate(self.lab_manual_content)
        curriulum_dump = [step.model_dump() for step in curriculum.curriculum]
        return curriulum_dump

    async def generate_persona(self)->Dict[str, Any]:
        """generate persona by referencing lab manual

        Returns:
            Dict[str, str]: persona
        """
        persona = await self.persona_generator.generate(self.lab_manual_content)
        persona_dump = persona.model_dump()
        return persona_dump
    
    async def compile_profile(self, curriculum: Optional[List[Dict[str, Any]]]=None, definition: Optional[Dict[str, Any]]=None, profile_name: Optional[str]=None) -> None:
        """compile the profile and save it to disk
        curriculum and definition is readable and can be modified by user
        but profile is not readable and not designed to be modified

        Args:
            curriculum (Optional[List[Dict[str, Any]]], optional): reviewed curriculum. Defaults: auto generated.
            definition (Optional[Dict[str, Any]], optional): reviewed definition. Defaults: auto generated.
            profile_name (Optional[str], optional): profile name. Defaults: topic_name.
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
        profile = self._assemble_profile(curriculum, definition, base_template, profile_name)
        
        # save
        self._save_profile(profile)
    
    def _assemble_profile(self, curriculum: List[Dict[str, Any]], definition: Dict[str, Any], base_template: str, profile_name: Optional[str]) -> Dict[str, Any]:
        """
        define the structure of profile
        """
        profile_name = profile_name or definition.get("topic_name") # use topic_name as its default(init) value
        profile = {
            "profile_id": str(uuid.uuid4()),
            "profile_name": profile_name, 
            "topic_name": definition.get("topic_name"),
            "persona_hints": definition.get("persona_hints"),
            "target_audience": definition.get("target_audience"),
            "curriculum": curriculum,
            "prompt_template": base_template            
        }
        return profile
    
    def _save_profile(self, profile: Dict[str, Any]) -> None:
        """save profile to disk

        Args:
            profile (Dict[str, Any]): profile
        """
        profile_id = profile.get("profile_id", None)
        if profile_id is None:
            raise ValueError("profile_id is required")
        output_path = self.output_dir / f"{profile_id}.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(profile, f, ensure_ascii=False, indent=2)
        
        print(f"Profile saved to {output_path}")

        
        
if __name__ == "__main__":
    # example usage
    async def main():
        with open(config.ROOT_DIR / "data_raw/seed_buffer_overflow/lab_manual.md", "r", encoding="utf-8") as f:
            lab_manual_content = f.read()
        profile_manager = ProfileGenerateManager(lab_manual_content)
        curriculum, definition = await asyncio.gather(
            profile_manager.generate_curriculum(),
            profile_manager.generate_persona()
        )
        await profile_manager.compile_profile(curriculum=curriculum, definition=definition)

    asyncio.get_event_loop().run_until_complete(main())
        
            
        
        
