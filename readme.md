# Socratic Agent Generator

一个基于苏格拉底式教学法的AI导师生成器，能够从实验手册自动生成个性化的智能导师配置，并同时提供了Web界面可运行苏格拉底智能体加载生成的配置文件并进行交互式学习。

## 项目特性

- 🤖 **智能导师生成**: 从实验手册自动生成苏格拉底式AI导师
- 🎯 **个性化教学**: 根据课程内容定制教学风格和引导方式  
- 🌐 **Web界面**: React前端 + FastAPI后端的现代化交互界面
- 🔄 **实时对话**: 支持实时师生对话和学习进度跟踪
- 🎨 **类GPT界面**: 仿ChatGPT的用户友好界面设计

## 系统架构

```
苏格拉底导师生成器
├── 后端 (Python + FastAPI)
│   ├── 导师配置生成器
│   ├── 课程大纲生成器  
│   ├── LLM集成 (DeepSeek)
│   └── RESTful API
├── 前端 (React + TypeScript)
│   ├── 导师选择界面
│   ├── 实时聊天窗口
│   └── 学习进度展示
└── 配置管理
    ├── 实验手册解析
    └── 导师配置输出
```

## 文件结构

```
socratic-agent-generator/
├── configs/                      # 课程配置和实验手册
│   └── seed_buffer_overflow/
│       ├── definition.yaml       # 课程元数据定义
│       ├── lab_manual.md         # 实验手册 (Markdown)
│       └── curriculum.json       # 生成的课程大纲
├── src/                          # 后端核心代码
│   ├── api_server.py            # FastAPI服务器
│   ├── main.py                  # 导师配置生成主程序
│   ├── tutor_runner.py          # 命令行导师运行器
│   └── generator/               # 生成器模块
│       ├── curriculum_generator.py
│       ├── prompt_assembler.py
│       └── persona_generator.py
├── frontend/                     # React前端应用
│   ├── src/
│   │   ├── App.tsx              # 主应用组件
│   │   ├── api/tutor.ts         # API客户端
│   │   └── components/          # UI组件
│   ├── package.json
│   └── vite.config.ts           # Vite构建配置
├── generated_tutors/             # 生成的导师配置文件
│   └── seed_buffer_overflow_profile.json
├── start-backend.sh             # 后端启动脚本
├── start-frontend.sh            # 前端启动脚本
├── start.sh                     # 一键启动脚本
└── requirements.txt             # Python依赖
```

## 快速开始

### 环境要求

- **Python**: 3.8+ 
- **Node.js**: 18+

### 1. 克隆项目

```bash
git clone <repository-url>
cd socratic-agent-generator
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，添加必要的API密钥 (如 DEEPSEEK_API_KEY)
```

### 2. 启动

#### 启动后端

推荐使用conda配置虚拟环境，需要先安装conda。不过如果不怕弄脏环境的话也可以不配置虚拟环境，不怕安装科学计算库可能遇到的二进制编译问题的话也可以使用venv。
创建虚拟环境
```bash
conda create -n SocraticGenerator -y
```
这里的环境名称SocraticGenerator可以自行修改，不过要自行保持后续使用的一致性。

启用虚拟环境
```bash
conda activate SocraticGenerator
```

第一次配置的时候需要先安装依赖
```bash
pip install -r requirements.txt
```

启动后端服务
```bash
python ./src/app.py
```


#### 启动前端

第一次启动时需要先安装依赖
```bash
npm install
```

```bash
npm run dev
```


## 使用方法

### 生成新的导师配置

1. **准备课程材料**
   ```bash
   mkdir configs/my_course
   # 添加 definition.yaml 和 lab_manual.md
   ```

2. **生成导师配置**
   ```bash
   python src/main.py --config-dir configs/my_course --output-dir generated_tutors
   ```

3. **生成课程大纲**
   ```bash
   python src/generate_curriculum.py --manual configs/my_course/lab_manual.md --output configs/my_course/curriculum.json
   ```

### 命令行模式

直接在终端中与导师对话:
```bash
python src/tutor_runner.py --profile generated_tutors/seed_buffer_overflow_profile.json
```
此处的profile可以替换为您针对自己的课程生成的profile

### Web界面模式

1. 启动服务 (见上述启动方法)
2. 打开 http://localhost:5173
3. 选择课程配置
4. 开始与AI导师对话

## API文档

后端提供以下RESTful API:

- `GET /api/profiles` - 列出可用的导师配置
- `POST /api/tutor/session` - 创建新的对话会话  
- `GET /api/tutor/{session_id}/welcome` - 获取导师欢迎消息
- `POST /api/tutor/{session_id}/message` - 发送消息并获取回复
- `GET /api/tutor/{session_id}/state` - 获取会话状态
- `GET /api/health` - 健康检查

API文档地址: http://localhost:8000/docs

## 开发指南

### 项目架构

1. **前端**: React + TypeScript + Vite + Tailwind CSS
2. **后端**: Python + FastAPI + LangChain

### 添加新的LLM支持

修改 `src/api_server.py` 中的 `TutorSession` 类:
```python
# 替换 ChatDeepSeek 为其他LLM
self.llm = ChatOpenAI(model="gpt-4", temperature=0.7)
```


## 故障排查

### 常见问题

**1. 前端依赖安装失败**  
- 删除 `frontend/node_modules` 后重新运行 `npm install`
- 确保 Node.js 版本 >= 18

**2. 后端启动失败**
- 检查虚拟环境是否正确激活
- 确保所有Python依赖已安装: `pip install -r requirements.txt`

**3. LLM调用失败**
- 检查 `.env` 文件中的API密钥配置
- 确认网络连接正常


## 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 提交Pull Request


## 更新日志

### v1.0.0 (2025-0-12)
- ✨ 初始版本发布
- 🎯 支持苏格拉底式导师生成
- 🌐 Web界面支持苏格拉底智能体运行

---

📧 如有问题或建议，请提交Issue或联系维护者。

## 许可证

MIT License

Copyright (c) 2025 Socratic Agent Generator

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.