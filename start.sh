#!/bin/bash

# Socratic Agent 默认启动脚本 (跨平台: Windows/Linux/macOS)
# Windows 使用方法: bash start.sh (需要 Git Bash 或 WSL)
# Linux/macOS 使用方法: ./start.sh 或 bash start.sh

cd "$(dirname "$0")"

# 检测操作系统 (优化版，避免触发WSL)
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ -n "$WINDIR" ]] || [[ -n "$SYSTEMROOT" ]] || [[ "$OS" == "Windows_NT" ]]; then
    OS_TYPE="Windows (Git Bash)"
    IS_WINDOWS=true
else
    OS_TYPE="Unix (Linux/macOS)"
    IS_WINDOWS=false
fi

echo "=========================================="
echo "  Socratic Agent 启动器 ($OS_TYPE)"
echo "=========================================="
echo ""
echo "🚀 正在启动前后端服务..."
echo ""

if $IS_WINDOWS; then
    # Windows 环境 - 使用后台进程
    echo "正在启动后端服务器..."
    ./start-backend.sh > backend.log 2>&1 &
    BACKEND_PID=$!
    echo "✓ 后端服务器已在后台启动 (PID: $BACKEND_PID)"
    
    echo "等待后端服务器初始化..."
    sleep 5
    
    echo "正在启动前端服务器..."
    ./start-frontend.sh > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "✓ 前端服务器已在后台启动 (PID: $FRONTEND_PID)"
    
    echo ""
    echo "📊 服务状态:"
    echo "  后端: http://localhost:8000 (PID: $BACKEND_PID)"
    echo "  前端: http://localhost:5173 (PID: $FRONTEND_PID)"
    echo ""
    echo "📋 实用命令:"
    echo "  查看后端日志: tail -f backend.log"
    echo "  查看前端日志: tail -f frontend.log"
    echo "  停止所有服务: kill $BACKEND_PID $FRONTEND_PID"
    echo ""
    
    # 检查后端健康状态 (使用Windows兼容的curl检查)
    echo "🔍 检查服务器状态..."
    for i in {1..12}; do
        # 使用更简单的健康检查，避免触发其他子系统
        if timeout 3 bash -c 'echo > /dev/tcp/localhost/8000' 2>/dev/null; then
            echo "✅ 后端服务器已就绪"
            break
        elif [ $i -eq 12 ]; then
            echo "⚠️  后端服务器启动超时，请检查日志: tail -f backend.log"
        else
            echo "⏳ 等待后端服务器启动... ($i/12)"
            sleep 2
        fi
    done
    
    # 检查前端进程状态
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "✅ 前端服务器正在运行"
    else
        echo "⚠️  前端服务器可能启动失败，请检查日志: tail -f frontend.log"
    fi
    
else
    # Linux/macOS 环境 - 优先使用终端会话管理
    if command -v tmux &> /dev/null; then
        echo "📱 使用 tmux 会话管理..."
        tmux new-session -d -s socratic-backend './start-backend.sh'
        sleep 3
        tmux new-session -d -s socratic-frontend './start-frontend.sh'
        
        echo "✅ 前后端已在 tmux 会话中启动"
        echo ""
        echo "📊 服务状态:"
        echo "  后端: http://localhost:8000 (tmux: socratic-backend)"
        echo "  前端: http://localhost:5173 (tmux: socratic-frontend)"
        echo ""
        echo "📋 实用命令:"
        echo "  查看所有会话: tmux list-sessions"
        echo "  连接后端会话: tmux attach -t socratic-backend"
        echo "  连接前端会话: tmux attach -t socratic-frontend"
        echo "  停止所有服务: tmux kill-session -t socratic-backend && tmux kill-session -t socratic-frontend"
        
    elif command -v screen &> /dev/null; then
        echo "📱 使用 screen 会话管理..."
        screen -dmS socratic-backend ./start-backend.sh
        sleep 3
        screen -dmS socratic-frontend ./start-frontend.sh
        
        echo "✅ 前后端已在 screen 会话中启动"
        echo ""
        echo "📊 服务状态:"
        echo "  后端: http://localhost:8000 (screen: socratic-backend)"
        echo "  前端: http://localhost:5173 (screen: socratic-frontend)"
        echo ""
        echo "📋 实用命令:"
        echo "  查看所有会话: screen -ls"
        echo "  连接后端会话: screen -r socratic-backend"
        echo "  连接前端会话: screen -r socratic-frontend"
        echo "  停止所有服务: screen -X -S socratic-backend quit && screen -X -S socratic-frontend quit"
        
    else
        echo "📱 使用后台进程..."
        ./start-backend.sh > backend.log 2>&1 &
        BACKEND_PID=$!
        sleep 3
        ./start-frontend.sh > frontend.log 2>&1 &
        FRONTEND_PID=$!
        
        echo "✅ 前后端已在后台启动"
        echo ""
        echo "📊 服务状态:"
        echo "  后端: http://localhost:8000 (PID: $BACKEND_PID)"
        echo "  前端: http://localhost:5173 (PID: $FRONTEND_PID)"
        echo ""
        echo "📋 实用命令:"
        echo "  查看日志: tail -f backend.log frontend.log"
        echo "  停止服务: kill $BACKEND_PID $FRONTEND_PID"
    fi
fi

echo ""
echo "🎉 启动完成！"
echo "🌐 请在浏览器中访问: http://localhost:5173"
echo ""
echo "💡 提示:"
echo "  - 如需单独启动后端: bash start-backend.sh"
echo "  - 如需单独启动前端: bash start-frontend.sh"
echo "  - 如遇问题请检查日志文件"