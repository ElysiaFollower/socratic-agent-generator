"""Main entry point for profile generation.

This module provides an interactive command-line interface for generating
tutor profiles from lab manuals. It guides users through the generation
process with options to regenerate persona and curriculum before finalizing.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from config import RAW_DATA_DIR, DATA_DIR
from generators.ProfileGenerateManager import ProfileGenerateManager
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def print_banner() -> None:
    """Print program banner and description."""
    print("=" * 70)
    print("  苏格拉底式AI导师配置生成器")
    print("  Socratic Agent Profile Generator")
    print("=" * 70)
    print()
    print("本程序的作用：")
    print("  基于实验文档（lab_manual.md）自动生成AI导师的Profile配置。")
    print("  Profile包含：")
    print("    - Persona（导师人设）：角色、风格、语气等")
    print("    - Curriculum（教学大纲）：苏格拉底式教学步骤")
    print("    - Prompt Template（提示词模板）：用于LLM对话")
    print()
    print("=" * 70)
    print()


def load_lab_manual(lab_dir: Path) -> str:
    """Load lab manual content from file.

    Args:
        lab_dir: Directory containing lab_manual.md.

    Returns:
        Lab manual content as string.

    Raises:
        FileNotFoundError: If lab_manual.md does not exist.
    """
    lab_manual_path = lab_dir / "lab_manual.md"
    if not lab_manual_path.exists():
        raise FileNotFoundError(
            f"实验文档未找到: {lab_manual_path}\n"
            f"请确保在 {lab_dir} 目录下存在 lab_manual.md 文件。"
        )

    with open(lab_manual_path, "r", encoding="utf-8") as f:
        content = f.read()

    logger.info("已加载实验文档: %s", lab_manual_path)
    return content


def print_persona(persona: TutorPersona) -> None:
    """Print persona information in a readable format.

    Args:
        persona: TutorPersona object to display.
    """
    print("\n" + "=" * 70)
    print("📋 Persona（导师人设）")
    print("=" * 70)
    print(f"主题名称: {persona.topic_name}")
    print(f"目标受众: {persona.target_audience}")
    print(f"人设提示: {', '.join(persona.persona_hints)}")
    print(f"领域约束: {', '.join(persona.domain_specific_constraints)}")
    print("=" * 70 + "\n")


def print_curriculum(curriculum: SocraticCurriculum) -> None:
    """Print curriculum information in a readable format.

    Args:
        curriculum: SocraticCurriculum object to display.
    """
    print("\n" + "=" * 70)
    print("📚 Curriculum（教学大纲）")
    print("=" * 70)
    print(f"总步骤数: {curriculum.get_len()}")
    print("\n步骤概览:")
    for i in range(1, curriculum.get_len() + 1):
        title = curriculum.get_step_title(i)
        print(f"  步骤 {i}: {title}")
    print("=" * 70 + "\n")


def save_persona(persona: TutorPersona, lab_dir: Path) -> Path:
    """Save persona to definition.json in lab directory.

    Args:
        persona: TutorPersona object to save.
        lab_dir: Directory to save the file.

    Returns:
        Path to the saved file.
    """
    output_path = lab_dir / "definition.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(persona.model_dump(), f, ensure_ascii=False, indent=2)
    logger.info("Persona已保存到: %s", output_path)
    return output_path


def save_curriculum(curriculum: SocraticCurriculum, lab_dir: Path) -> Path:
    """Save curriculum to curriculum.json in lab directory.

    Args:
        curriculum: SocraticCurriculum object to save.
        lab_dir: Directory to save the file.

    Returns:
        Path to the saved file.
    """
    output_path = lab_dir / "curriculum.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(curriculum.model_dump(), f, ensure_ascii=False, indent=2)
    logger.info("Curriculum已保存到: %s", output_path)
    return output_path


def load_persona(lab_dir: Path) -> Optional[TutorPersona]:
    """Load persona from definition.json in lab directory.

    Args:
        lab_dir: Directory containing definition.json.

    Returns:
        TutorPersona object if file exists, None otherwise.
    """
    definition_path = lab_dir / "definition.json"
    if not definition_path.exists():
        return None

    try:
        with open(definition_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        persona = TutorPersona.model_validate(data)
        logger.info("已从文件加载Persona: %s", definition_path)
        return persona
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("加载Persona失败: %s", e)
        return None


def load_curriculum(lab_dir: Path) -> Optional[SocraticCurriculum]:
    """Load curriculum from curriculum.json in lab directory.

    Args:
        lab_dir: Directory containing curriculum.json.

    Returns:
        SocraticCurriculum object if file exists, None otherwise.
    """
    curriculum_path = lab_dir / "curriculum.json"
    if not curriculum_path.exists():
        return None

    try:
        with open(curriculum_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        curriculum = SocraticCurriculum.model_validate(data)
        logger.info("已从文件加载Curriculum: %s", curriculum_path)
        return curriculum
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("加载Curriculum失败: %s", e)
        return None


def print_commands() -> None:
    """Print available commands."""
    print("\n可用命令：")
    print("  [rp] 或 regenerate-persona    - 重新生成Persona")
    print("  [rc] 或 regenerate-curriculum - 重新生成Curriculum")
    print("  [c]  或 continue              - 继续生成Profile并保存")
    print("  [q]  或 quit                  - 退出程序")
    print()


async def interactive_generation(lab_dir_name: str = "example") -> None:
    """Interactive profile generation workflow.

    Args:
        lab_dir_name: Name of the lab directory in data_raw/.
            Defaults to "example".
    """
    print_banner()

    # Load lab manual
    lab_dir = RAW_DATA_DIR / lab_dir_name
    try:
        lab_manual_content = load_lab_manual(lab_dir)
    except FileNotFoundError as e:
        logger.error(str(e))
        return

    # Initialize ProfileGenerateManager
    print(f"⏳ 正在初始化生成器...")
    manager = ProfileGenerateManager(lab_manual_content)
    logger.info("生成器初始化完成")

    # Try to load existing persona and curriculum
    persona = load_persona(lab_dir)
    curriculum = load_curriculum(lab_dir)

    if persona is None or curriculum is None:
        # Generate initial persona and curriculum
        print("\n⏳ 正在生成Persona和Curriculum...")
        print("   (这可能需要几分钟时间，请耐心等待...)")

        try:
            persona, curriculum = await asyncio.gather(
                manager.generate_persona(),
                manager.generate_curriculum(),
            )
            print("✅ 生成完成！\n")

            # Save persona and curriculum to lab directory
            persona_path = save_persona(persona, lab_dir)
            curriculum_path = save_curriculum(curriculum, lab_dir)

            print("\n" + "=" * 70)
            print("📝 中间产物已保存")
            print("=" * 70)
            print(f"Persona:   {persona_path}")
            print(f"Curriculum: {curriculum_path}")
            print()
            print("💡 提示: 您可以编辑这两个JSON文件，然后继续生成Profile。")
            print("   重新生成会覆盖这些文件。")
            print("=" * 70 + "\n")

        except Exception as e:
            logger.error("生成失败: %s", e)
            return
    else:
        print("\n✅ 检测到已存在的Persona和Curriculum文件，已加载。")
        print(f"   Persona:   {lab_dir / 'definition.json'}")
        print(f"   Curriculum: {lab_dir / 'curriculum.json'}")
        print("💡 提示: 使用 [rp] 或 [rc] 可以重新生成并覆盖这些文件。\n")

    # Interactive review loop
    while True:
        # Display current persona and curriculum
        if persona:
            print_persona(persona)
        if curriculum:
            print_curriculum(curriculum)

        # Show commands
        print_commands()

        # Get user input
        user_input = input("请输入命令: ").strip().lower()

        if user_input in ["q", "quit"]:
            print("\n程序已退出。")
            return

        elif user_input in ["rp", "regenerate-persona"]:
            print("\n⏳ 正在重新生成Persona...")
            try:
                persona = await manager.generate_persona()
                # Save to file (will overwrite existing)
                persona_path = save_persona(persona, lab_dir)
                print("✅ Persona重新生成完成！")
                print(f"   已保存到: {persona_path}\n")
            except Exception as e:
                logger.error("重新生成Persona失败: %s", e)
                print("❌ 重新生成失败，请重试。\n")

        elif user_input in ["rc", "regenerate-curriculum"]:
            print("\n⏳ 正在重新生成Curriculum...")
            try:
                curriculum = await manager.generate_curriculum()
                # Save to file (will overwrite existing)
                curriculum_path = save_curriculum(curriculum, lab_dir)
                print("✅ Curriculum重新生成完成！")
                print(f"   已保存到: {curriculum_path}\n")
            except Exception as e:
                logger.error("重新生成Curriculum失败: %s", e)
                print("❌ 重新生成失败，请重试。\n")

        elif user_input in ["c", "continue"]:
            if persona is None or curriculum is None:
                print("\n❌ 错误：Persona或Curriculum未生成，无法继续。\n")
                continue

            # Sync data state: reload from files before continuing
            print("\n⏳ 正在同步数据状态（从文件读取最新版本）...")
            loaded_persona = load_persona(lab_dir)
            loaded_curriculum = load_curriculum(lab_dir)

            if loaded_persona is not None:
                persona = loaded_persona
                print("✅ 已从文件加载Persona")
            else:
                print("⚠️  未找到Persona文件，使用内存中的版本")

            if loaded_curriculum is not None:
                curriculum = loaded_curriculum
                print("✅ 已从文件加载Curriculum")
            else:
                print("⚠️  未找到Curriculum文件，使用内存中的版本")

            # Compile and save profile
            print("\n⏳ 正在组装Profile并保存...")
            try:
                # Determine output directory: data/tutor_profiles/{lab_dir_name}
                output_dir = DATA_DIR / "tutor_profiles" / lab_dir_name
                output_dir.mkdir(parents=True, exist_ok=True)

                profile = await manager.compile_profile(
                    curriculum=curriculum,
                    definition=persona,
                    profile_name=lab_dir_name,
                    output_dir=output_dir,
                )

                print("\n" + "=" * 70)
                print("✅ Profile生成成功！")
                print("=" * 70)
                print(f"Profile ID: {profile.profile_id}")
                print(f"主题名称: {profile.topic_name}")
                print(f"保存位置: {output_dir / f'{profile.profile_id}.json'}")
                print("=" * 70 + "\n")

                logger.info("Profile已保存到: %s", output_dir)
                # Continue loop instead of returning, user can press 'q' to exit
                continue

            except Exception as e:
                logger.error("Profile生成失败: %s", e)
                print(f"\n❌ Profile生成失败: {e}\n")

        else:
            print("\n❌ 无效命令，请重试。\n")


def main() -> None:
    """Main entry point."""
    import sys

    # Parse command line arguments
    lab_dir_name = "example"
    if len(sys.argv) > 1:
        lab_dir_name = sys.argv[1]

    try:
        asyncio.run(interactive_generation(lab_dir_name))
    except KeyboardInterrupt:
        print("\n\n程序被用户中断。")
    except Exception as e:
        logger.error("程序执行失败: %s", e)
        raise


if __name__ == "__main__":
    main()
