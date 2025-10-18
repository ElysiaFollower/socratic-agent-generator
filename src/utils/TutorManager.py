from pathlib import Path
from typing import Dict, Any, List
from fastapi import HTTPException

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[0]))
from utils.tutor_core import Tutor
from schemas.profile import Profile

class TutorManager:
    """管理活跃的、在内存中的Tutor实例，充当缓存层。"""
    
    def __init__(self):
        # 缓存：只缓存活跃的Tutor实例
        self.active_tutors: Dict[str, Tutor] = {}
        print("TutorManager initialized.")

    def get_tutor(self, session_id: str) -> Tutor:
        """
        获取Tutor实例的核心函数。
        优先从内存缓存中获取，如果失败则从磁盘加载并存入缓存。
        """
        # 优先从内存缓存中获取
        if session_id in self.active_tutors:
            return self.active_tutors[session_id]

        # 如果缓存中没有，则从磁盘加载
        try:
            print(f"Cache miss. Loading Tutor (Session: {session_id}) from disk...")
            tutor = Tutor.from_id(session_id)
            
            # 将新加载的实例存入缓存
            self.active_tutors[session_id] = tutor
            return tutor
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Session not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load session: {e}")

    def create_tutor(self, profile: Profile, session_name: str, output_language: str) -> Tutor:
        """
        创建一个新的Tutor实例。
        Tutor.create_new 会自动持久化(save)到磁盘。
        我们将其添加到内存缓存中。
        """
        print(f"Creating new tutor for profile: {profile.profile_id}...")
        tutor = Tutor.create_new(
            profile=profile,
            session_name=session_name,
            output_language=output_language
        )
        
        # 存入缓存
        self.active_tutors[tutor.session.session_id] = tutor
        return tutor

    def remove_from_cache(self, session_id: str):
        """
        仅从内存缓存中移除一个Tutor实例。
        (例如，在删除或重命名会话时调用)
        """
        if session_id in self.active_tutors:
            print(f"Removing Tutor (Session: {session_id}) from cache.")
            self.active_tutors.pop(session_id, None)