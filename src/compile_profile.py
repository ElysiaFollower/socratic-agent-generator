import json
import jinja2
from pathlib import Path

from generators.prompt_assembler import PromptAssembler

def compile_profile(config_dir: Path, template_path: Path, output_path: Path):
    """
    Compiles source files into a single, runnable tutor profile.
    """
    print(f"⚙️ Compiling profile from {config_dir}...")

    # 1. Load the source files
    with open(config_dir / "definition.json", 'r', encoding='utf-8') as f:
        definition = json.load(f)
    with open(config_dir / "curriculum.json", 'r', encoding='utf-8') as f:
        curriculum = json.load(f)
    with open(template_path, 'r', encoding='utf-8') as f:
        prompt_template_string = f.read()

    # 2. Assemble the final profile dictionary
    # This dictionary is the "executable" for the Tutor
    final_profile = {
        "topic_name": definition.get("topic_name"),
        "target_audience": definition.get("target_audience"),
        "persona_hints": definition.get("persona_hints"),
        "domain_specific_constraints": definition.get("domain_specific_constraints"),
        "learning_objectives": definition.get("learning_objectives"),
        "curriculum": curriculum, # Assuming curriculum is a dict with a "curriculum" key
        "prompt_template_string": prompt_template_string # The raw template string is now part of the profile!
    }

    # 3. Write the final, self-contained profile
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_profile, f, ensure_ascii=False, indent=2)

    print(f"✅ Profile compiled successfully to {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Compile a Tutor profile from source files.")
    parser.add_argument("--config-dir", type=str, required=True, help="Path to the directory containing the source files.")
    parser.add_argument("--template-path", type=str, required=True, help="Path to the template file.")
    
    args = parser.parse_args()
    compile_profile(
        config_dir=Path(args.config_dir),
        template_path=Path(args.template_path),
        output_path=Path(args.config_dir + "/profile.json")
    )
