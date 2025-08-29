#!/bin/bash

# Socratic Agent 后端启动脚本 (跨平台: Windows/Linux/macOS)
# Windows 使用方法: bash start-backend.sh (需要 Git Bash 或 WSL)
# Linux/macOS 使用方法: ./start-backend.sh 或 bash start-backend.sh

cd "$(dirname "$0")"

echo "=========================================="
echo "  启动 Socratic Agent 后端 API 服务器"
echo "=========================================="

echo "[1/4] 检测操作系统和激活虚拟环境..."

# 改进的操作系统检测逻辑
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ -n "$WINDIR" ]] || [[ -n "$SYSTEMROOT" ]] || [[ "$OS" == "Windows_NT" ]] || [[ -d "/mnt/c" ]]; then
    # Windows 环境 (Git Bash, MSYS2, Cygwin, WSL)
    OS_TYPE="Windows"
    VENV_ACTIVATE_SUFFIX="Scripts/activate"
else
    # Linux/macOS 环境
    OS_TYPE="Unix"
    VENV_ACTIVATE_SUFFIX="bin/activate"
fi

echo "检测到操作系统: $OS_TYPE"

# 尝试激活虚拟环境 - 改进检测和激活逻辑
VENV_FOUND=false
VENV_PATH=""

# 检查 .seedAI 虚拟环境（Windows 和 Unix 路径）
if [ -f ".seedAI/Scripts/activate" ]; then
    VENV_PATH=".seedAI"
    source ".seedAI/Scripts/activate"
    echo "✓ 虚拟环境路径: .seedAI/Scripts/activate"
    VENV_FOUND=true
elif [ -f ".seedAI/bin/activate" ]; then
    VENV_PATH=".seedAI"
    source ".seedAI/bin/activate"
    echo "✓ 虚拟环境路径: .seedAI/bin/activate"
    VENV_FOUND=true
# 检查其他常见虚拟环境名称
elif [ -f "venv/Scripts/activate" ]; then
    VENV_PATH="venv"
    source "venv/Scripts/activate"
    echo "✓ 虚拟环境路径: venv/Scripts/activate"
    VENV_FOUND=true
elif [ -f "venv/bin/activate" ]; then
    VENV_PATH="venv"
    source "venv/bin/activate"
    echo "✓ 虚拟环境路径: venv/bin/activate"
    VENV_FOUND=true
elif [ -f ".venv/Scripts/activate" ]; then
    VENV_PATH=".venv"
    source ".venv/Scripts/activate"
    echo "✓ 虚拟环境路径: .venv/Scripts/activate"
    VENV_FOUND=true
elif [ -f ".venv/bin/activate" ]; then
    VENV_PATH=".venv"
    source ".venv/bin/activate"
    echo "✓ 虚拟环境路径: .venv/bin/activate"
    VENV_FOUND=true
fi

if [ "$VENV_FOUND" = false ]; then
    echo "❌ 错误: 找不到虚拟环境"
    echo "请检查虚拟环境是否存在于以下路径之一："
    echo "  - .seedAI/Scripts/activate (Windows)"
    echo "  - .seedAI/bin/activate (Unix)"
    echo "  - venv/Scripts/activate (Windows)"
    echo "  - venv/bin/activate (Unix)"
    echo ""
    echo "如需创建新的虚拟环境，请运行: python -m venv .seedAI"
    exit 1
fi

# 验证虚拟环境是否真正激活
echo "验证虚拟环境激活状态..."
echo "Python 路径: $(which python)"
echo "pip 路径: $(which pip)"

# 如果虚拟环境未真正激活，使用完整路径
if [[ "$(which python)" == *"$VENV_PATH"* ]] && [[ "$(which pip)" == *"$VENV_PATH"* ]]; then
    echo "✓ 虚拟环境已正确激活"
    PIP_CMD="pip"
    PYTHON_CMD="python"
else
    echo "⚠️ 虚拟环境激活异常，使用完整路径"
    if [ -f "$VENV_PATH/Scripts/pip.exe" ]; then
        PIP_CMD="$VENV_PATH/Scripts/pip.exe"
        PYTHON_CMD="$VENV_PATH/Scripts/python.exe"
    elif [ -f "$VENV_PATH/bin/pip" ]; then
        PIP_CMD="$VENV_PATH/bin/pip"
        PYTHON_CMD="$VENV_PATH/bin/python"
    else
        echo "❌ 错误: 无法找到虚拟环境的 pip"
        exit 1
    fi
    echo "使用 pip: $PIP_CMD"
    echo "使用 python: $PYTHON_CMD"
fi

echo "[2/4] 检查并安装后端依赖..."
if ! $PYTHON_CMD -c "import fastapi" 2>/dev/null; then
    echo "安装 FastAPI..."
    $PIP_CMD install fastapi uvicorn python-dotenv
    if [ $? -ne 0 ]; then
        echo "❌ 安装 FastAPI 失败"
        exit 1
    fi
fi

if ! $PYTHON_CMD -c "import uvicorn" 2>/dev/null; then
    echo "安装 Uvicorn..."
    $PIP_CMD install uvicorn
    if [ $? -ne 0 ]; then
        echo "❌ 安装 Uvicorn 失败"
        exit 1
    fi
fi

echo "[3/4] 检查环境变量文件..."
if [ ! -f ".env" ]; then
    echo "⚠️  警告: .env 文件不存在，将使用默认配置"
    echo "如需使用真实 LLM，请复制 .env.example 为 .env 并配置 API keys"
fi

echo "[4/4] 启动后端服务器..."
echo "后端将运行在: http://localhost:8000"
echo "健康检查: http://localhost:8000/api/health"
echo "API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "=========================================="

# 使用正确的 Python 路径启动 uvicorn
if command -v uvicorn &> /dev/null; then
    uvicorn src.api_server:app --reload --host 0.0.0.0 --port 8000
elif [ -f "$VENV_PATH/Scripts/uvicorn.exe" ]; then
    "$VENV_PATH/Scripts/uvicorn.exe" src.api_server:app --reload --host 0.0.0.0 --port 8000
elif [ -f "$VENV_PATH/bin/uvicorn" ]; then
    "$VENV_PATH/bin/uvicorn" src.api_server:app --reload --host 0.0.0.0 --port 8000
else
    $PYTHON_CMD -m uvicorn src.api_server:app --reload --host 0.0.0.0 --port 8000
fi