# 在命令行终端运行智能体导师

import argparse
from pathlib import Path
from tutor_core import Tutor # 从我们的新模块导入

def cli_main():
    """主函数：导师运行器"""
    parser = argparse.ArgumentParser(description="苏格拉底智能体运行器")
    parser.add_argument(
        "--profile", 
        type=str, 
        required=True,
        help="要加载的导师配置档案(.json)的路径。"
    )
    args = parser.parse_args()

    # 1. 创建Tutor实例
    try:
        tutor = Tutor(Path(args.profile))
    except Exception as e:
        print(e)
        return

    session_id = f"cli_session_{Path(args.profile).stem}" # 命令行用一个固定的session_id
    print("--- 苏格拉底导师已上线 ---")
    print(tutor.get_welcome_message() + '(输入 \'q\' 或 \'exit\' 退出)')

    while True:
        user_input = input("你: ")
        if user_input.lower() in ['q', 'exit']:
            print("导师：学习贵在坚持，期待下次与你继续探讨！")
            break

        result = tutor.process_message(session_id, user_input)
        
        print("导师:", result["reply"])

        if result["is_finished"]:
            break


if __name__ == "__main__":
   cli_main()