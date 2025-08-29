#!/bin/bash

# Socratic Agent 一键启动脚本 (跨平台: Windows/Linux/macOS)
# Windows 使用方法: bash start.sh (需要 Git Bash 或 WSL)
# Linux/macOS 使用方法: ./start.sh 或 bash start.sh

cd "$(dirname "$0")"

# 改进的操作系统检测逻辑
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ -n "$WINDIR" ]] || [[ -n "$SYSTEMROOT" ]] || [[ "$OS" == "Windows_NT" ]] || [[ -d "/mnt/c" ]]; then
    OS_TYPE="Windows (Git Bash/WSL)"
else
    OS_TYPE="Unix (Linux/macOS)"
fi

echo "=========================================="
echo "  Socratic Agent 一键启动 ($OS_TYPE)"
echo "=========================================="
echo ""
echo "选择启动模式:"
echo "[1] 启动后端服务器"
echo "[2] 启动前端开发服务器"
echo "[3] 同时启动前后端 (推荐)"
echo "[4] 退出"
echo ""
read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "启动后端服务器..."
        bash start-backend.sh
        ;;
    2)
        echo ""
        echo "启动前端服务器..."
        bash start-frontend.sh
        ;;
    3)
        echo ""
        echo "同时启动前后端..."
        
        if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ -n "$WINDIR" ]] || [[ -n "$SYSTEMROOT" ]] || [[ "$OS" == "Windows_NT" ]] || [[ -d "/mnt/c" ]]; then
            # Windows 环境 - 改进后台进程管理
            echo "正在启动后端服务器..."
            bash start-backend.sh > backend.log 2>&1 &
            BACKEND_PID=$!
            echo "后端服务器已在后台启动 (PID: $BACKEND_PID)"
            echo "后端日志: tail -f backend.log"
            
            echo "等待后端服务器启动..."
            sleep 5
            
            echo "正在启动前端服务器..."
            bash start-frontend.sh > frontend.log 2>&1 &
            FRONTEND_PID=$!
            echo "前端服务器已在后台启动 (PID: $FRONTEND_PID)"
            echo "前端日志: tail -f frontend.log"
            
            echo ""
            echo "✓ 前后端服务已启动"
            echo "✓ 后端: http://localhost:8000 (PID: $BACKEND_PID)"
            echo "✓ 前端: http://localhost:5173 (PID: $FRONTEND_PID)"
            echo ""
            echo "实时查看日志:"
            echo "  后端日志: tail -f backend.log"
            echo "  前端日志: tail -f frontend.log"
            echo ""
            echo "停止服务:"
            echo "  kill $BACKEND_PID $FRONTEND_PID"
            echo "  或者关闭 Git Bash 窗口"
            echo ""
            echo "等待服务器完全启动..."
            
            # 检查服务器状态
            echo "检查服务器状态..."
            for i in {1..10}; do
                if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
                    echo "✓ 后端服务器已就绪"
                    break
                elif [ $i -eq 10 ]; then
                    echo "⚠️ 后端服务器启动可能有问题，请查看日志: tail -f backend.log"
                else
                    echo "等待后端服务器启动... ($i/10)"
                    sleep 2
                fi
            done
            
            # 简单的前端检查（检查进程是否还在运行）
            if kill -0 $FRONTEND_PID 2>/dev/null; then
                echo "✓ 前端服务器正在运行"
            else
                echo "⚠️ 前端服务器可能启动失败，请查看日志: tail -f frontend.log"
            fi
            
        else
            # Linux/macOS 环境 - 优先使用 tmux 或 screen
            if command -v tmux &> /dev/null; then
                echo "使用 tmux 会话管理..."
                tmux new-session -d -s backend 'bash start-backend.sh'
                sleep 3
                tmux new-session -d -s frontend 'bash start-frontend.sh'
                echo "✓ 前后端已在 tmux 会话中启动"
                echo "✓ 后端: http://localhost:8000 (tmux session: backend)"
                echo "✓ 前端: http://localhost:5173 (tmux session: frontend)"
                echo ""
                echo "查看会话: tmux list-sessions"
                echo "连接后端: tmux attach -t backend"
                echo "连接前端: tmux attach -t frontend"
                echo "停止服务: tmux kill-session -t backend && tmux kill-session -t frontend"
            elif command -v screen &> /dev/null; then
                echo "使用 screen 会话管理..."
                screen -dmS backend bash start-backend.sh
                sleep 3
                screen -dmS frontend bash start-frontend.sh
                echo "✓ 前后端已在 screen 会话中启动"
                echo "✓ 后端: http://localhost:8000 (screen session: backend)"
                echo "✓ 前端: http://localhost:5173 (screen session: frontend)"
                echo ""
                echo "查看会话: screen -ls"
                echo "连接后端: screen -r backend"
                echo "连接前端: screen -r frontend"
                echo "停止服务: pkill -f 'start-backend.sh' && pkill -f 'start-frontend.sh'"
            else
                echo "使用后台进程..."
                bash start-backend.sh > backend.log 2>&1 &
                BACKEND_PID=$!
                sleep 3
                bash start-frontend.sh > frontend.log 2>&1 &
                FRONTEND_PID=$!
                echo "✓ 前后端已在后台启动"
                echo "✓ 后端: http://localhost:8000 (PID: $BACKEND_PID)"
                echo "✓ 前端: http://localhost:5173 (PID: $FRONTEND_PID)"
                echo ""
                echo "查看日志: tail -f backend.log frontend.log"
                echo "停止服务: kill $BACKEND_PID $FRONTEND_PID"
            fi
        fi
        echo ""
        echo "🎉 启动完成！"
        echo "请在浏览器中访问: http://localhost:5173"
        echo ""
        echo "如遇问题，请检查日志文件或单独启动前后端进行调试。"
        ;;
    4)
        echo "退出..."
        exit 0
        ;;
    *)
        echo "无效选择，请输入 1-4"
        exit 1
        ;;
esac