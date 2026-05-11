# 初始化契约

## 自举条件

- 能启动：后端 `python src/app.py`；前端 `cd frontend && npm run dev`
- 能测试：`./scripts/harness-check.sh`、`python3 -m compileall src`、`cd frontend && npm test -- --run`
- 能看进度：`harness/progress.md` 和 `harness/feature_list.json`
- 能接手下一步：`harness/session-handoff.md` 和 `plans/active/`

## 环境

- 技术栈：Python/FastAPI/LangChain/SQLAlchemy/SQLite 后端；React 18/TypeScript/Vite/Material UI 前端。
- 运行时版本：README 要求 Python 3.8+、Node.js 18+；推荐本地后端环境使用 Python 3.9。
- 依赖安装：后端 `pip install -r requirements.txt`；前端 `cd frontend && npm ci`。
- 本地服务：后端默认 `http://localhost:8000`；前端默认 `http://localhost:5173`，Vite 将 `/api` 代理到后端。
- 配置文件：从 `.env.example` 复制 `.env`，至少为认证配置 `JWT_SECRET_KEY` 和 `ADMIN_TOKEN`；LLM key 可由环境预设或用户设置面板提供。

## 标准命令

```sh
conda create -n SocraticAgent python=3.9 -y
conda activate SocraticAgent
pip install -r requirements.txt
cd frontend && npm ci

python src/app.py
cd frontend && npm run dev

./scripts/harness-check.sh
python3 -m compileall src
cd frontend && npm test -- --run
cd frontend && npm run build
```

## 初始化验收清单

- [x] 从仓库文档可推导依赖安装方式。
- [x] 项目启动方式在 README、`init.sh` 和本文件中一致。
- [x] 至少一个可靠验证命令能运行。
- [x] `./scripts/harness-check.sh` 通过。
- [x] 新 agent 只看仓库能回答：是什么、怎么跑、怎么测、当前进度、下一步。

## 已知缺口

- 后端目前没有独立测试套件；最低验证是 `python3 -m compileall src`。
- 前端测试依赖 `frontend/node_modules`，新 checkout 需要先运行 `cd frontend && npm ci`。
- 完整端到端流程需要有效 `.env`、LLM provider 配置和必要模型/向量索引环境。
