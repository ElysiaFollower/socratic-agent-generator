"""Command-line interface for interacting with tutors.

This module provides a simple CLI for debugging and batch data collection
by allowing users to interact with tutor sessions via command line.
"""

import argparse
import logging
import sys

from core.database import SessionLocal
from utils.profile_manager import ProfileManager
from utils.tutor_core import Tutor
from utils.session_manager import SessionManager
from schemas.profile import Profile

# Setup logging
logging.basicConfig(
    level=logging.WARNING,  # Reduce noise for CLI
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def load_profile(profile_id: str) -> Profile:
    """Load a profile by ID.

    Args:
        profile_id: The profile ID to load.

    Returns:
        Profile object.

    Raises:
        FileNotFoundError: If profile not found.
    """
    db = SessionLocal()
    try:
        manager = ProfileManager(db)
        try:
            return manager.read_profile(profile_id)
        except Exception as e:
            raise FileNotFoundError(f"无法加载Profile '{profile_id}': {e}")
    finally:
        db.close()


def list_profiles() -> None:
    """List all available profiles."""
    db = SessionLocal()
    try:
        manager = ProfileManager(db)
        profiles = manager.list_profiles()
    finally:
        db.close()

    if not profiles:
        print("未找到任何Profile。")
        return

    print("\n可用的Profile列表：")
    print("=" * 70)
    for i, profile in enumerate(profiles, 1):
        print(f"{i}. {profile.profile_id}")
        print(f"   主题: {profile.topic_name}")
        print(f"   创建时间: {profile.create_at}")
        print()
    print("=" * 70)


def cli_main() -> None:
    """Main function for tutor CLI."""
    parser = argparse.ArgumentParser(
        description="苏格拉底式AI导师命令行交互工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 列出所有可用的Profile
  python tutor_cli.py --list

  # 使用Profile ID启动对话
  python tutor_cli.py --profile-id <profile_id>

  # 使用自定义Profile目录
  python tutor_cli.py --profile-id <profile_id> --profiles-dir ./custom_profiles
        """,
    )
    parser.add_argument(
        "--profile-id",
        type=str,
        help="要使用的Profile ID（必需，除非使用--list）",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="列出所有可用的Profile",
    )
    parser.add_argument(
        "--session-name",
        type=str,
        default="CLI会话",
        help="会话名称（默认: CLI会话）",
    )

    args = parser.parse_args()

    # Handle list command
    if args.list:
        list_profiles()
        return

    # Validate profile-id
    if not args.profile_id:
        parser.error("必须提供 --profile-id 或使用 --list 查看可用Profile")

    # Load profile
    try:
        profile = load_profile(args.profile_id)
        print(f"\n✅ 已加载Profile: {profile.topic_name}")
    except FileNotFoundError as e:
        print(f"\n❌ 错误: {e}")
        print("\n提示: 使用 --list 查看所有可用的Profile")
        sys.exit(1)

    # Create tutor session
    try:
        print(f"\n⏳ 正在创建会话...")
        tutor = Tutor.create_new(
            profile=profile,
            session_name=args.session_name,
            owner_id="cli",
        )
        print(f"✅ 会话已创建: {tutor.session.session_id}\n")
    except Exception as e:
        logger.error("创建会话失败: %s", e)
        print(f"\n❌ 创建会话失败: {e}")
        sys.exit(1)

    # Start interactive loop
    print("=" * 70)
    print("  苏格拉底式AI导师 - 命令行交互")
    print("=" * 70)
    print(f"主题: {profile.topic_name}")
    print(f"会话ID: {tutor.session.session_id}")
    print()
    print("提示: 输入 'q' 或 'exit' 退出")
    print("=" * 70)
    print()

    # Print welcome message
    welcome_msg = tutor.get_welcome_message()
    print(f"导师: {welcome_msg}\n")

    # Conversation loop
    while True:
        try:
            user_input = input("你: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["q", "exit", "quit"]:
                print("\n导师: 学习贵在坚持，期待下次与你继续探讨！")
                break

            # Process message
            response = tutor.process_message(user_input)

            # Print response
            print(f"\n导师: {response.reply}\n")

            # Check if finished
            if response.is_finished:
                print("=" * 70)
                print("学习会话已完成！")
                print("=" * 70)
                break

        except KeyboardInterrupt:
            print("\n\n程序被用户中断。")
            break
        except Exception as e:
            logger.error("处理消息时出错: %s", e)
            print(f"\n❌ 错误: {e}\n")

    print(f"\n会话已保存: {tutor.session.session_id}")


if __name__ == "__main__":
    cli_main()
