<!--
职责：通过 Remote Runner 将 Socratic Agent Generator 与 DreamingRAG 部署到 linux-01，并提供可访问演示链接。
边界：不修改业务功能，不提交密钥，不重配 remote-runner 机器凭据，不把服务器运维细节写成长期产品边界。
-->

# linux-01 Live Deployment

## 目标

在 `linux-01` 上部署当前 `rag-memory-adapter` 分支：

- Socratic 后端可通过服务器地址访问。
- Socratic 前端可通过服务器地址访问。
- DreamingRAG 作为默认后端依赖安装，并通过 Socratic memory adapter mock smoke 验证。
- 服务通过远端 tmux 会话持久运行。
- 给用户可访问链接和验证证据。

## 非目标

- 不新增业务功能。
- 不配置正式域名、HTTPS、反向代理、systemd 或 CI/CD。
- 不泄漏、打印或提交 API key。
- 不修改 DreamingRAG 源码。

## 验收标准

- `linux-01` remote-runner doctor 通过。
- 远端工作目录包含 Socratic 与 DreamingRAG。
- 远端 Python 环境安装 Socratic requirements 和 `pip install -e ../DreamingRAG`。
- 远端 `python -m compileall src tests` 与 DreamingRAG/Socratic adapter smoke 通过。
- 后端和前端分别在 tmux 会话中运行。
- 从本地或远端 curl 能访问后端 health/docs 与前端页面。
- `harness/session-handoff.md`、`harness/progress.md` 和本 plan 记录部署证据。

## 验证命令

```bash
conda run -n seedrunner remote-runner machine doctor linux-01 --json
conda run -n seedrunner remote-runner session exec --session <id> --cmd '<deploy/test commands>' --json
curl -I http://10.203.15.128:<frontend-port>
curl -s http://10.203.15.128:<backend-port>/docs
```

## 完成定义

- 部署完成或明确记录阻塞点。
- 若服务成功运行，保留服务 tmux 会话。
- 清理 remote-runner 控制会话或说明为什么保留。
- 归档本 plan，feature evidence 与 handoff 同步。

## 结果

- 部署路径：`/home/ely/deploy/socratic-live/`
- Socratic 后端：tmux session `socratic-backend`，监听 `0.0.0.0:8000`
- Socratic 前端：tmux session `socratic-frontend`，监听 `0.0.0.0:5173`
- 公开访问：
  - Frontend: `http://10.203.15.128:5173`
  - Backend docs: `http://10.203.15.128:8000/docs`
  - Health: `http://10.203.15.128:8000/api/health`
- 远端验证：
  - `env_has_deepseek=True`
  - `env_has_volcengine=True`
  - `env_embedding_provider=volcengine`
  - `env_embedding_model=doubao-embedding-vision-251215`
  - focused pytest: 22 passed
  - `model_check= (True, [], [])`
  - `embedding_class= VolcengineArkEmbeddings`
  - built-in public profiles: 6 labs
  - external curl health/docs/frontend passed
  - demo user login, profile list, session creation, and yes-message streaming passed after the fallback tool-name fix
