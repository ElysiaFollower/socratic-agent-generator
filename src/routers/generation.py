from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pathlib import Path
import uuid
from ..schemas.requests import LabManualRequest, CurriculumGenerationRequest, PersonaGenerationRequest, ProfileCompilationRequest
from ..schemas.curriculum import SocraticCurriculum
from ..schemas.definition import TutorPersona
from ..schemas.profile import Profile
from ..config import LAB_MANUALS_DIR, CURRICULA_DIR, PERSONAS_DIR, PROFILES_DIR
from ..utils.DataManager import DataManager
from ..generators.CurriculumGenerator import CurriculumGenerator
from ..agents.persona_agent import PersonaAgent
from ..generators.ProfileGenerateManager import ProfileGenerateManager
from .. import config
import asyncio

router = APIRouter()

class LabManualManager:
    def __init__(self, directory: Path):
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)

    def create(self, content: str) -> str:
        lab_manual_id = str(uuid.uuid4())
        file_path = self.directory / f"{lab_manual_id}.md"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return lab_manual_id

    def read(self, lab_manual_id: str) -> Optional[str]:
        file_path = self.directory / f"{lab_manual_id}.md"
        if not file_path.exists():
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

lab_manual_manager = LabManualManager(LAB_MANUALS_DIR)
curriculum_manager = DataManager(CURRICULA_DIR, SocraticCurriculum, "curriculum_id")
persona_manager = DataManager(PERSONAS_DIR, TutorPersona, "persona_id")
profile_manager = DataManager(PROFILES_DIR, Profile, "profile_id")

@router.post("/lab_manuals", summary="Upload a new lab manual.")
async def upload_lab_manual(req: LabManualRequest):
    lab_manual_id = lab_manual_manager.create(req.content)
    return {"lab_manual_id": lab_manual_id}

@router.post("/curricula", summary="Generate a new curriculum from a lab manual.")
async def generate_curriculum(req: CurriculumGenerationRequest):
    lab_manual_content = lab_manual_manager.read(req.lab_manual_id)
    if not lab_manual_content:
        raise HTTPException(status_code=404, detail="Lab manual not found")

    generator = CurriculumGenerator(llm=config.get_default_llm())
    curriculum = await generator.generate(lab_manual_content)
    curriculum_manager.create(curriculum)

    return curriculum

@router.get("/curricula", response_model=List[SocraticCurriculum], summary="List all curricula.")
async def list_curricula():
    return curriculum_manager.list()

@router.get("/curricula/{curriculum_id}", response_model=SocraticCurriculum, summary="Get a specific curriculum.")
async def get_curriculum(curriculum_id: str):
    curriculum = curriculum_manager.read(curriculum_id)
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum

@router.post("/personas", summary="Generate a new persona from a lab manual.")
async def generate_persona(req: PersonaGenerationRequest):
    lab_manual_content = lab_manual_manager.read(req.lab_manual_id)
    if not lab_manual_content:
        raise HTTPException(status_code=404, detail="Lab manual not found")

    agent = PersonaAgent(llm=config.get_default_llm())
    persona = await agent.generate(lab_manual_content)
    persona_manager.create(persona)

    return persona

@router.get("/personas", response_model=List[TutorPersona], summary="List all personas.")
async def list_personas():
    return persona_manager.list()

@router.get("/personas/{persona_id}", response_model=TutorPersona, summary="Get a specific persona.")
async def get_persona(persona_id: str):
    persona = persona_manager.read(persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona

@router.post("/profiles", summary="Compile a new profile from a curriculum and persona.")
async def compile_profile(req: ProfileCompilationRequest):
    curriculum = curriculum_manager.read(req.curriculum_id)
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    persona = persona_manager.read(req.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    profile_manager_generator = ProfileGenerateManager(llm=config.get_default_llm())
    profile = await profile_manager_generator.compile_profile(curriculum, persona, req.profile_name)

    return profile
