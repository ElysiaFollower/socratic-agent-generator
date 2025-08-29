#!/bin/bash

# Socratic Agent 前端启动脚本 (跨平台: Windows/Linux/macOS)
# Windows 使用方法: bash start-frontend.sh (需要 Git Bash 或 WSL)
# Linux/macOS 使用方法: ./start-frontend.sh 或 bash start-frontend.sh

cd "$(dirname "$0")"

echo "=========================================="
echo "  启动 Socratic Agent 前端开发服务器"
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

# 尝试激活虚拟环境 - 改进检测逻辑
VENV_FOUND=false

# 检查 .seedAI 虚拟环境（Windows 和 Unix 路径）
if [ -f ".seedAI/Scripts/activate" ]; then
    source ".seedAI/Scripts/activate"
    echo "✓ 虚拟环境已激活: .seedAI (Windows)"
    VENV_FOUND=true
elif [ -f ".seedAI/bin/activate" ]; then
    source ".seedAI/bin/activate"
    echo "✓ 虚拟环境已激活: .seedAI (Unix)"
    VENV_FOUND=true
# 检查其他常见虚拟环境名称
elif [ -f "venv/Scripts/activate" ]; then
    source "venv/Scripts/activate"
    echo "✓ 虚拟环境已激活: venv (Windows)"
    VENV_FOUND=true
elif [ -f "venv/bin/activate" ]; then
    source "venv/bin/activate"
    echo "✓ 虚拟环境已激活: venv (Unix)"
    VENV_FOUND=true
elif [ -f ".venv/Scripts/activate" ]; then
    source ".venv/Scripts/activate"
    echo "✓ 虚拟环境已激活: .venv (Windows)"
    VENV_FOUND=true
elif [ -f ".venv/bin/activate" ]; then
    source ".venv/bin/activate"
    echo "✓ 虚拟环境已激活: .venv (Unix)"
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

echo "[2/4] 进入前端目录..."
if [ ! -d "frontend" ]; then
    echo "❌ 错误: 无法找到 frontend 目录"
    exit 1
fi
cd frontend

echo "[3/4] 检查并安装前端依赖..."
if [ ! -d "node_modules" ]; then
    echo "首次运行，安装 Node.js 依赖..."
    if ! command -v npm &> /dev/null; then
        echo "❌ 错误: 未找到 npm 命令"
        echo "请安装 Node.js 18+ 版本: https://nodejs.org/"
        exit 1
    fi
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 错误: npm install 失败"
        exit 1
    fi
else
    echo "✓ Node.js 依赖已存在"
fi

echo "[4/4] 启动前端开发服务器..."
echo "前端将运行在: http://localhost:5173"
echo "后端代理: /api -> http://localhost:8000"
echo ""
echo "请确保后端服务器已在另一个终端中启动"
echo "按 Ctrl+C 停止服务器"
echo "=========================================="

npm run dev