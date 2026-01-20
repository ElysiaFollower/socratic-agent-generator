/**
 * Help content components for user manuals.
 *
 * Provides formatted content components for different management panels.
 */

import React from "react";
import { Box, Stack, Typography, Divider } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Section component for help content.
 */
interface HelpSectionProps {
  readonly icon: string;
  readonly title: string;
  readonly content: string;
}

function HelpSection(props: HelpSectionProps): JSX.Element {
  const { icon, title, content } = props;
  const markdownStyles = {
    "& p": { m: 0, mb: 1, lineHeight: 1.7 },
    "& p:last-child": { mb: 0 },
    "& ul, & ol": { pl: 2, my: 1, listStylePosition: "outside" },
    "& ul": { listStyleType: "disc" },
    "& ol": { listStyleType: "decimal" },
    "& li": { mb: 0.5 },
    "& code": {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "0.85em",
      px: 0.6,
      py: 0.2,
      borderRadius: 0.75,
      bgcolor: "var(--color-surface-muted)",
    },
    "& pre": {
      m: 0,
      mb: 1,
      p: 1.5,
      borderRadius: 1,
      overflowX: "auto",
      bgcolor: "var(--color-surface-muted)",
    },
    "& pre code": {
      bgcolor: "transparent",
      p: 0,
    },
    "& blockquote": {
      m: 0,
      mb: 1,
      pl: 1.5,
      borderLeft: "3px solid var(--color-border)",
      color: "text.secondary",
    },
    "& a": {
      color: "inherit",
      textDecoration: "underline",
    },
    "& strong": {
      fontWeight: 600,
    },
  } as const;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1.5 }}>
        <Typography variant='h6' sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
          {icon} {title}
        </Typography>
      </Stack>
      <Box sx={{ pl: 1, ...markdownStyles }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </Box>
    </Box>
  );
}

/**
 * Lab manual help content component.
 */
export function LabManualHelpContent(): JSX.Element {
  return (
    <Stack spacing={2}>
      <HelpSection
        icon='🎯'
        title='核心价值'
        content={`*"实验文档是AI tutor的知识基础。上传你的实验手册，系统将基于这些内容生成专业的教学助手。"*`}
      />

      <Divider />

      <HelpSection
        icon='📚'
        title='设计理念'
        content={`- 实验文档是tutor学习的"教科书"
- 支持Markdown格式，保留结构化信息
- 每个文档可以独立管理，便于版本控制`}
      />

      <Divider />

      <HelpSection
        icon='🚀'
        title='使用流程'
        content={`1. **上传文档：** 拖拽或点击上传.md文件
2. **命名管理：** 系统自动提取文件名，可自定义
3. **查看内容：** 随时预览文档内容
4. **删除更新：** 管理文档生命周期`}
      />

      <Divider />

      <HelpSection
        icon='💡'
        title='最佳实践'
        content={`- 使用清晰的文档结构（标题、列表、代码块）
- 定期更新文档内容，保持tutor知识的新鲜度
- 为不同实验创建独立的文档`}
      />

      <Divider />

      <HelpSection
        icon='🔗'
        title='下一步'
        content={`上传文档后，前往"Profile管理"生成对应的tutor配置`}
      />
    </Stack>
  );
}

/**
 * Profile manager help content component.
 */
export function ProfileManagerHelpContent(): JSX.Element {
  return (
    <Stack spacing={2}>
      <HelpSection
        icon='🎯'
        title='核心价值'
        content={`*"让AI为你自动生成tutor！只需选择实验文档，系统会自动生成导师人设和教学大纲，你只需审核调整即可。每个Profile就是一个完整的AI tutor。"*`}
      />

      <Divider />

      <HelpSection
        icon='📚'
        title='设计理念'
        content={`- **自动生成：** AI智能分析实验文档，自动生成导师人设和教学大纲
- **用户可监控可调：** 生成后你可以审核、修正或重新生成，确保质量
- Profile = 一个完整的tutor = 实验文档 + AI生成的导师配置
- 每个Profile可以发布为独立的学习会话`}
      />

      <Divider />

      <HelpSection
        icon='🚀'
        title='使用流程'
        content={`1. **选择实验文档：** 从已上传的文档中选择

2. **配置基础参数（可选）：**
   - 目标受众（学生/教师）
   - 课程主题和名称
   - 其他提示信息

3. **AI自动生成：**
   - 系统分析实验文档内容
   - 自动生成导师人设（教学风格、角色定位）
   - 自动生成教学大纲（学习步骤、知识结构）

4. **审核与调整：**
   - 查看AI生成的内容
   - 进行事实性审核和修正
   - 不满意可重新生成
   - 确认后固化为Profile

5. **管理Profile：** 查看、重命名、删除已有Profile`}
      />

      <Divider />

      <HelpSection
        icon='💡'
        title='最佳实践'
        content={`- 充分利用AI自动生成能力，减少手动配置工作
- 重点审核生成内容的事实准确性，而非完全重写
- 为同一实验文档创建多个Profile，服务不同受众或场景
- 使用描述性的Profile名称，便于识别和管理
- 定期检查Profile的教学大纲是否合理，及时调整`}
      />

      <Divider />

      <HelpSection
        icon='🔗'
        title='关联功能'
        content={`- 前置：需要先上传实验文档
- 后续：可在"Skill管理"中为Profile添加增强能力`}
      />
    </Stack>
  );
}

/**
 * Skill manager help content component.
 */
export function SkillManagerHelpContent(): JSX.Element {
  return (
    <Stack spacing={2}>
      <HelpSection
        icon='🎯'
        title='核心价值'
        content={`*"Skill是tutor的'专业技能包'。通过上传补充资料，让tutor在特定领域表现更专业、回答更准确。"*`}
      />

      <Divider />

      <HelpSection
        icon='📚'
        title='设计理念'
        content={`- Skill = Profile + 补充知识库
- 支持为特定Profile上传额外的辅助文档
- 检索型Skill可以实时查询补充资料，提供精准答案`}
      />

      <Divider />

      <HelpSection
        icon='🚀'
        title='使用流程'
        content={`1. **选择Profile：** 确定要为哪个tutor添加能力

2. **上传补充资料：** 上传.md、.txt格式的文档

3. **创建Skill：**
   - 方式一：AI自动生成（基于补充资料）
   - 方式二：手动创建（自定义技能）

4. **配置Skill类型：**
   - 检索型：需要关联补充资料，实时查询
   - 普通型：基于已有知识

5. **管理Skill：** 查看、分配、删除已有Skill`}
      />

      <Divider />

      <HelpSection
        icon='💡'
        title='最佳实践'
        content={`- 补充资料应该聚焦特定主题，避免过于宽泛
- 检索型Skill适合需要精确引用的场景
- 定期更新补充资料，保持Skill的时效性`}
      />

      <Divider />

      <HelpSection
        icon='🔗'
        title='关联功能'
        content={`- 前置：需要先创建Profile
- 作用：增强Profile对应tutor的回复能力`}
      />
    </Stack>
  );
}
