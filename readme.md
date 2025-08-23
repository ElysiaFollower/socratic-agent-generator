### 项目目标

苏格拉底智能体元生成器

### 文件结构

socratic-agent-generator/
├── configs/                      # 【输入】关于课程和教学目标的必要描述, 用于生成智能体
│   └── seed_buffer_overflow/
│       ├── definition.yaml       # <--- “元数据”文件
│       └── lab_manual.md         # <--- 实验文档的Markdown版本
│
├── src/                  # 【核心逻辑】所有生成器源代码
│   ├── main.py           # 程序主入口，负责编排整个生成流程
│   ├── generator/
│   │   ├── curriculum_generator.py # 模块1: 教学大纲生成器
│   │   ├── persona_generator.py    # 模块2: 导师人设生成器
│   │   └── prompt_assembler.py     # 模块3: 系统提示词组装器
│   ├── templates/
│   │   └── system_prompt_master.jinja2 # 系统提示词的主模板
│   └── tutor_runner.py          # 导师运行器 (可供调试使用)
│
├── generated_tutors/     # 【输出】最终生成的“导师配置档案”
│   └── seed_bof_profile.json
│
└── requirements.txt      # 项目依赖库
└── README.md             # 项目说明

### 大致运行流程


### example

python src/tutor_runner.py --profile generated_tutors/seed_buffer_overflow_profile.json