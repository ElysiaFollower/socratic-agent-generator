from dotenv import load_dotenv
load_dotenv()

import argparse
import json
from pathlib import Path
import sys



from src.generators.PersonaGenerator import PersonaGenerator

from langchain_deepseek import ChatDeepSeek
from config import TEMPERATURE

def main():
    """Main function to run the persona generation process."""
    parser = argparse.ArgumentParser(description="Generate a definition.json from a lab manual.")
    parser.add_argument("--manual", type=Path, required=True, help="Path to the lab_manual.md file.")
    args = parser.parse_args()

    output_path = args.manual.parent / "definition.json"

    try:
        with open(args.manual, 'r', encoding='utf-8') as f:
            lab_content = f.read()
    except FileNotFoundError:
        print(f"Error: Manual file not found at {args.manual}")
        sys.exit(1)

    # Initialize the LLM and the Generator
    # llm = initialize_llm() # You would have a function for this
    # For now, let's assume `llm` is available
    llm = ChatDeepSeek(model="deepseek-chat", temperature=TEMPERATURE)
    generator = PersonaGenerator(llm=llm)

    # --- Run the Core Logic ---
    try:
        generated_definition = generator.generate(lab_content)
    except Exception as e:
        print(f"❌ An error occurred during generation: {e}")
        sys.exit(1)
    # ---

    # Save the output
    print(f"💾 Saving generated definition to: {output_path}")
    # Pydantic's .model_dump() is great for serialization
    definition_dict = generated_definition.model_dump()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(definition_dict, f, ensure_ascii=False, indent=2)

    print("✅ Generation complete!")

if __name__ == "__main__":
    main()