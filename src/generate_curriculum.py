from dotenv import load_dotenv
load_dotenv()

import os
import json
import argparse
from pathlib import Path
from typing import Any

# --- 核心模块导入 ---
from generator.curriculum_generator import CurriculumGenerator

# --- LLM 与环境 ---
from langchain_deepseek import ChatDeepSeek


def main():
    """主函数：教学大纲生成器"""
    parser = argparse.ArgumentParser(description="苏格拉底教学大纲生成器")
    parser.add_argument(
        "--manual", 
        type=str, 
        required=True,
        help="实验指导手册的 Markdown 文件路径。"
    )
    args = parser.parse_args()

    # --- 1. 路径与加载 ---
    manual_path = Path(args.manual)
    output_path = manual_path.parent / "curriculum.json"
    
    if not manual_path.exists():
        print(f"错误：实验手册文件未找到 -> {manual_path}")
        return

    print(f"✅ 正在从 '{manual_path}' 加载实验手册...")
    with open(manual_path, 'r', encoding='utf-8') as f:
        lab_manual_content = f.read()

    # --- 2. 初始化LLM和生成器 ---
    llm = ChatDeepSeek(model="deepseek-chat", temperature=0.1)
    
    curriculum_generator = CurriculumGenerator(llm)

    # --- 3. 调用核心模块生成 ---
    print("\n--- 开始根据文档生成教学大纲 ---")
    curriculum = curriculum_generator.generate(lab_manual_content)
    
    # --- 4. 写入输出 ---
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"⏳ 正在将教学大纲草稿写入 '{output_path}'...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(curriculum, f, ensure_ascii=False, indent=2)

    print("\n🎉 教学大纲生成成功！")
    print("👉 下一步：请检查并按需修改输出文件，然后运行 assemble_profile.py 进行最终封装。")
    print(f"   查看输出: {output_path.resolve()}")

if __name__ == "__main__":
    # 为了让这个脚本能找到 generator 模块，我们需要一些路径技巧
    # 或者在运行时设置 PYTHONPATH
    import sys
    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from generator.curriculum_generator import CurriculumGenerator
    main()