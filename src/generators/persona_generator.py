from typing import List, Dict, Any
from pydantic import BaseModel, Field

# --- LangChain & LLM ---
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import MAX_INPUT_TOKENS

class TutorPersona(BaseModel):
    """
    The complete, structured metadata for a lesson, automatically inferred
    from a lab manual. This will be saved as definition.json.
    """
    topic_name: str = Field(description="A concise and descriptive title for the lab/topic.")

    persona_hints: List[str] = Field(
        description="A list of creative and fitting clues to define the tutor's persona (role, tone, style, catchphrase)."
    )

    domain_specific_constraints: List[str] = Field(
        description="Important rules or ethical considerations specific to the lab's domain (e.g., security ethics, lab safety)."
    )

    target_audience: str = Field(
        description="The inferred target audience based on the manual's complexity and content."
    )


class PersonaGenerator:
    """
    Generate persona for tutor
    given out persona_hints/target_audience in json format
    """
    def __init__(self, llm: Any, max_retries: int = 3):
        self.llm = llm
        self.max_retries = max_retries
        self.output_parser = JsonOutputParser(pydantic_object=TutorPersona)
        self.prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are an expert Instructional Designer and AI Persona Architect for a Socratic tutoring system. "
             "Your task is to analyze a raw technical lab manual and generate a complete, structured metadata file for it. "
             "You must infer all information, including a creative and fitting persona for the tutor.\n\n"
             "Analyze the provided lab manual to determine the following:\n"
             "1.  **topic_name**: Create a clear, compelling title for the lab.\n"
             "2.  **target_audience**: Infer the intended audience (e.g., 'Beginners in Python', 'Advanced cybersecurity students') based on the manual's complexity, prerequisites, and tone.\n"
             "3.  **persona_hints**: Be creative. Invent an engaging persona that fits the lab's subject matter. For a hacking lab, a 'CTF champion' persona is great. For a data science lab, a 'data detective' might be fitting. Define their role, tone, style, and a catchphrase.\n"
             "4.  **domain_specific_constraints**: Identify crucial rules or ethical guidelines. For security labs, this is about ethics. For science labs, it could be about safety.\n\n"
             "Produce a single JSON object that strictly follows the provided format instructions:\"{format_instructions}\". Be insightful and creative."),
            ("user",
             "Here is the lab manual. Please analyze it and generate the complete definition metadata.\n\n"
             "<lab_manual>\n"
             "{lab_manual_content}\n"
             "</lab_manual>")
        ])
        self.chain = self.prompt | self.llm | self.output_parser
        
    def _create_excerpt(self, content: str, max_chars: int = 4000) -> str:
        """Creates an excerpt of the content to avoid exceeding token limits."""
        if len(content) <= max_chars:
            return content
        # Combine the beginning and end, which are often the most info-rich parts.
        return content[:max_chars//2] + "\n\n... (content truncated) ...\n\n" + content[-max_chars//2:]

 
    def generate(self, lab_manual_content: str) -> TutorPersona:
        """
        by given lab manual content, generate persona information for tutor (only the begining and the ending slice will be used)
        like what a person he/she is, who he/she is trying to teach, what main concepts he/she is going to teach
        """
        print("🤖 Analyzing lab manual to generate definition.json...")
        content_excerpt = self._create_excerpt(lab_manual_content, max_chars=MAX_INPUT_TOKENS-1000)

        for attempt in range(self.max_retries):
            try:
                generated_data = self.chain.invoke({
                    "lab_manual_content": content_excerpt,
                    "format_instructions": self.output_parser.get_format_instructions()
                })
                result = TutorPersona.model_validate(generated_data)
                return result
            except Exception as e:
                print(f"❌ [Attempt {attempt + 1}/{self.max_retries}] Error generating definition: {e}")
                if attempt + 1 == self.max_retries:
                    raise RuntimeError(f"Definition generation failed after {self.max_retries} attempts.") from e
        
        # This line should not be reachable due to the raise in the loop
        raise RuntimeError("Definition generation failed unexpectedly.")
        
if __name__ == "__main__":
    #example usage; run at the root directory
    with open("./data_raw/seed_buffer_overflow/lab_manual.md", "r") as f:
        lab_manual_content = f.read()
    
    from langchain_deepseek import ChatDeepSeek
    import config
    from dotenv import load_dotenv
    load_dotenv()  
    
    generator = PersonaGenerator(llm = ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE))
    definition =  generator.generate(lab_manual_content)
    print(definition.model_dump_json(indent=2))