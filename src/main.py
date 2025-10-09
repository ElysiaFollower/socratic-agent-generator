import os
import json
import json
import argparse
from pathlib import Path
from src.utils.prompt_assembler import assemble_socratic_prompt
import config

def main():
    """程序主入口"""
    parser = argparse.ArgumentParser(description="苏格拉底智能体配置生成器")
    parser.add_argument(
        "--dir-name", 
        type=str, 
        required=True,
        help="包含 definition.json 和 curriculum.json 的课题配置文件夹名。"
    )
    args = parser.parse_args()

    # --- 1. 路径处理 ---
    config_path = config.RAW_DATA_DIR / Path(args.config_dir)
    output_path = config.PROFILES_DIR
    definition_file = config_path / "definition.json"
    curriculum_file = config_path / "curriculum.json"
    
    # 确保输入文件存在
    if not definition_file.exists() or not curriculum_file.exists():
        print(f"错误：在'{config_path}'中未找到 definition.json 或 curriculum.json。")
        return

    print(f"✅ 正在从 '{config_path}' 加载课题定义...")

    # --- 2. 加载输入 ---
    with open(definition_file, 'r', encoding='utf-8') as f:
        definition = json.load(f)
    
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
        "system_prompt_template": system_prompt, # 我们称之为模板，因为还有一个插槽；这个插槽是为了让苏格拉底智能体在运行时自动填充的
        "curriculum": curriculum
    }

    print(f"⏳ 正在将导师配置档案写入 '{output_file}'...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(tutor_profile, f, ensure_ascii=False, indent=2)

    print("\n🎉 生成成功！你可以在以下位置找到导师配置档案:")
    print(f"   {output_file.resolve()}")

if __name__ == "__main__":
    main()