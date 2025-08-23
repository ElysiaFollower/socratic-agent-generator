import os
import json
import yaml
import argparse
from pathlib import Path
from generator.prompt_assembler import assemble_socratic_prompt

def main():
    """程序主入口"""
    parser = argparse.ArgumentParser(description="苏格拉底智能体生成器 - 阶段一")
    parser.add_argument(
        "--config-dir", 
        type=str, 
        required=True,
        help="包含 definition.yaml 和 curriculum.json 的课题配置文件夹路径。"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="generated_tutors",
        help="生成的导师配置档案的输出目录。"
    )
    args = parser.parse_args()

    # --- 1. 路径处理 ---
    config_path = Path(args.config_dir)
    output_path = Path(args.output_dir)
    definition_file = config_path / "definition.yaml"
    curriculum_file = config_path / "curriculum.json"
    
    # 确保输入文件存在
    if not definition_file.exists() or not curriculum_file.exists():
        print(f"错误：在'{config_path}'中未找到 definition.yaml 或 curriculum.json。")
        return

    print(f"✅ 正在从 '{config_path}' 加载课题定义...")

    # --- 2. 加载输入 ---
    with open(definition_file, 'r', encoding='utf-8') as f:
        definition = yaml.safe_load(f)
    
    with open(curriculum_file, 'r', encoding='utf-8') as f:
        curriculum = json.load(f)

    print("✅ 课题定义加载成功。")

    # --- 3. 调用核心模块生成 ---
    print("⏳ 正在组装系统提示词...")
    system_prompt = assemble_socratic_prompt(definition, curriculum)
    print("✅ 系统提示词组装完成。")

    # --- 4. 构造并写入输出 ---
    # 确保输出目录存在
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 使用配置文件夹的名字作为输出文件的名字
    profile_name = config_path.name
    output_file = output_path / f"{profile_name}_profile.json"

    tutor_profile = {
        "topic_name": definition.get("topic_name", profile_name),
        "version": definition.get("version", 1.0),
        "system_prompt_template": system_prompt, # 我们称之为模板，因为还有一个插槽
        "curriculum": curriculum
    }

    print(f"⏳ 正在将导师配置档案写入 '{output_file}'...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(tutor_profile, f, ensure_ascii=False, indent=2)

    print("\n🎉 生成成功！你可以在以下位置找到导师配置档案:")
    print(f"   {output_file.resolve()}")

if __name__ == "__main__":
    main()