#!/usr/bin/env sh
# 职责：初始化本地项目 harness，并运行最便宜且可靠的 sanity checks。
# 边界：不要安装全局工具、写入密钥、启动长运行服务，或意外修改项目源码。

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$repo_root"

echo "项目：Socratic Agent Generator - 文档到苏格拉底式 AI 导师的生成与学习系统"
echo "技术栈：Python/FastAPI/LangChain/SQLite 后端；React/TypeScript/Vite/Material UI 前端"

if [ -x "./scripts/harness-check.sh" ]; then
  ./scripts/harness-check.sh
else
  echo "缺少可执行文件 scripts/harness-check.sh"
fi

cat <<'EOF'

启动命令：
- 后端：python src/app.py
- 前端：cd frontend && npm run dev

聚焦验证：
- ./scripts/harness-check.sh
- python3 -m compileall src
- cd frontend && npm test -- --run

完整验证：
- cd frontend && npm run build
- 手动启动后端和前端，验证登录、上传文档、生成 Profile、创建会话和流式对话。

依赖安装：
- 后端默认部署：conda create -n SocraticAgent python=3.10 -y && conda activate SocraticAgent && pip install -r requirements.txt && pip install -e ../DreamingRAG
- 前端：cd frontend && npm ci
- 官方部署文档：docs/deployment.md
EOF
