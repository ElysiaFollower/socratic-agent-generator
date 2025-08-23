import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

# --- LangChain核心组件 ---
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser

# --- LLM选择 ---
# TODO: 未来可以把这里做成可配置的，以加载不同的LLM。
from langchain_deepseek import ChatDeepSeek
from dotenv import load_dotenv

def load_tutor_profile(profile_path: Path) -> Dict[str, Any]:
    """
    加载并验证导师配置档案。
    """
    if not profile_path.exists():
        raise FileNotFoundError(f"错误：导师配置档案未找到 -> {profile_path}")
    
    with open(profile_path, 'r', encoding='utf-8') as f:
        try:
            profile = json.load(f)
        except json.JSONDecodeError:
            raise ValueError(f"错误：无法解析JSON文件 -> {profile_path}")

    # 验证关键字段是否存在
    required_keys = ["topic_name", "system_prompt_template", "curriculum"]
    if not all(key in profile for key in required_keys):
        raise ValueError("错误：配置文件中缺少必要的字段 (topic_name, system_prompt_template, curriculum)")
        
    return profile



def main():
    """主函数：导师运行器"""
    parser = argparse.ArgumentParser(description="苏格拉底智能体运行器")
    parser.add_argument(
        "--profile", 
        type=str, 
        required=True,
        help="要加载的导师配置档案(.json)的路径。"
    )
    args = parser.parse_args()

    # --- 1. 加载配置档案 ---
    try:
        tutor_profile = load_tutor_profile(Path(args.profile))
    except (FileNotFoundError, ValueError) as e:
        print(e)
        return

    # 从档案中提取核心数据
    topic_name = tutor_profile["topic_name"]
    system_prompt_template = tutor_profile["system_prompt_template"]
    curriculum = tutor_profile["curriculum"]

    # --- 2. 初始化LLM和核心组件  ---
    load_dotenv()
    llm = ChatDeepSeek(model="deepseek-chat", temperature=0.7)

    conversation_states = {}
    history_store = {}

    def get_session_history(session_id: str) -> ChatMessageHistory:
        if session_id not in history_store:
            history_store[session_id] = ChatMessageHistory()
        return history_store[session_id]

    # 主智能体链
    prompt = ChatPromptTemplate.from_messages([
        ("system", "{system_prompt_with_state}"),
        MessagesPlaceholder(variable_name="history"),
        ("user", "{input}"),
    ])

    chain = prompt | llm | StrOutputParser()

    chain_with_history = RunnableWithMessageHistory(
        chain,
        get_session_history,
        input_messages_key="input",
        history_messages_key="history",
    )
    
    # 评估器链
    evaluator_prompt = "教学目标：{step_desc}。学生回答：{user_input}。他是否已经正确理解或完成了这个步骤？请只回答'是'或'否'，不要有任何其他多余的字。"
    evaluator_chain = ChatPromptTemplate.from_template(evaluator_prompt) | llm | StrOutputParser()

    # --- 3. 启动交互循环 ---
    # TODO: 转向实际应用的时候应当优化session_id的设置
    session_id = f"session_{Path(args.profile).stem}" # 使用文件名作为唯一session_id —— 测试用
    config = {"configurable": {"session_id": session_id}}

    # 欢迎语
    print("--- 苏格拉底导师已上线 ---")
    print(f"导师：你好！今天我们来挑战一下“{topic_name}”。准备好了吗？(输入 'q' 或 'exit' 退出)")

    while True:
        # 需要维护当前对话状态——任务进行到第几步
        if session_id not in conversation_states:
            conversation_states[session_id] = {"step": 0}
        current_state = conversation_states[session_id]
        
        step_index = current_state["step"]
        
        # 检查是否已完成所有步骤
        if step_index >= len(curriculum):
            print("导师：太棒了！你已经完成了本次的所有学习任务。期待与你进行下一次的探讨！")
            break
            
        current_step_description = curriculum[step_index]

        # 提前退出机关
        user_input = input("你: ")
        if user_input.lower() in ['q', 'exit']:
            print("导师：学习贵在坚持，期待下次与你继续探讨！")
            break
        
        # 跳步机关
        if user_input.lower() == 'next':
            print("--- (强制进入下一关) ---")
            current_state["step"] = min(step_index + 1, len(curriculum))
            if current_state["step"] < len(curriculum):
                print(f"导师：(我们直接来看下一步吧) ; 对应任务为: {curriculum[current_state['step']]}")
            continue

        # 评估学生回答
        evaluation_result = evaluator_chain.invoke({
            "step_desc": current_step_description,
            "user_input": user_input
        })

        if "是" in evaluation_result:
            print("\n--- (导师在后台欣慰地点了点头，认为你已掌握，准备进入下一步) ---\n")
            current_state["step"] += 1
            step_index = current_state["step"]
            current_step_description = curriculum[step_index]
        # TODO: 删除这段调试代码
        if len(evaluation_result) > 1:
            print(f"--- (评价结果: {evaluation_result}) ---")
            print(f"--- (当前步骤: {current_state['step']}) ---")
        
        # 填充系统提示词模板
        # 用加载的模板，填充动态的当前步骤描述
        formatted_system_prompt = system_prompt_template.format(
            current_step_description=current_step_description
        )
        
        response = chain_with_history.invoke({
            "system_prompt_with_state": formatted_system_prompt,
            "input": user_input
        }, config=config)

        print("导师:", response)

if __name__ == "__main__":
    main()