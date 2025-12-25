# API 接口说明文档

## 1. 概述

本文档描述了苏格拉底式 AI 导师后端服务的所有 API 端点。API 基于 RESTful 设计，使用 JSON 格式进行数据交换。

**Base URL**: `http://{host}:{port}` (默认: `http://0.0.0.0:8000`)

**API 文档**: 访问 `http://{host}:{port}/docs` 查看交互式 API 文档

## 2. 通用说明

### 2.1 请求格式

- **Content-Type**: `application/json`
- **字符编码**: UTF-8

### 2.2 响应格式

- **成功响应**: HTTP 200，JSON 格式
- **错误响应**: HTTP 4xx/5xx，包含错误详情

### 2.3 数据格式

- 所有时间字段使用 ISO 8601 格式（UTC）
- UUID 使用标准 UUID v4 格式

## 3. API 端点列表

### 3.1 健康检查

#### GET /api/health

检查服务健康状态。

**响应示例**:
```json
{
  "status": "ok"
}
```

---

## 4. Profile 管理 API

### 4.1 获取所有 Profile

#### GET /api/profiles

获取所有可用的导师配置列表。

**响应**: `List[Profile]`

**响应示例**:
```json
[
  {
    "profile_id": "550e8400-e29b-41d4-a716-446655440000",
    "profile_name": "Buffer Overflow",
    "topic_name": "缓冲区溢出攻击",
    "persona_hints": ["耐心", "引导式"],
    "target_audience": "计算机安全专业学生",
    "curriculum": { ... },
    "prompt_template": "...",
    "create_at": "2025-01-15T10:30:00Z"
  }
]
```

**说明**: 
- Profile 按创建时间倒序排列（最新的在前）
- 无效的 Profile 文件会被跳过

### 4.2 获取指定 Profile

#### GET /api/profiles/{profile_id}

获取指定导师的完整配置。

**路径参数**:
- `profile_id` (string): Profile 的唯一标识符

**响应**: `Profile`

**响应示例**:
```json
{
  "profile_id": "550e8400-e29b-41d4-a716-446655440000",
  "profile_name": "Buffer Overflow",
  "topic_name": "缓冲区溢出攻击",
  "persona_hints": ["耐心", "引导式"],
  "target_audience": "计算机安全专业学生",
  "curriculum": {
    "steps": [
      {
        "step_index": 1,
        "title": "理解缓冲区溢出概念",
        "success_criteria": "...",
        "hints": [...]
      }
    ]
  },
  "prompt_template": "...",
  "create_at": "2025-01-15T10:30:00Z"
}
```

**错误响应**:
- `404`: Profile 不存在

**Profile 保存位置**: `data/tutor_profiles/{profile_id}.json`

---

## 5. Session 管理 API

### 5.1 获取所有 Session

#### GET /api/sessions

获取所有会话的元信息列表。

**响应**: `List[SessionSummary]`

**响应示例**:
```json
[
  {
    "session_id": "660e8400-e29b-41d4-a716-446655440001",
    "session_name": "我的学习会话",
    "profile_id": "550e8400-e29b-41d4-a716-446655440000",
    "profile_name": "Buffer Overflow",
    "topic_name": "缓冲区溢出攻击",
    "create_at": "2025-01-15T11:00:00Z",
    "update_at": "2025-01-15T11:30:00Z"
  }
]
```

**说明**: 
- Session 按创建时间倒序排列（最新的在前）
- 返回的是摘要信息，不包含完整的对话历史

### 5.2 创建新 Session

#### POST /api/sessions/create

创建一个新的学习会话。

**请求体**: `CreateSessionRequest`

```json
{
  "profile_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_name": "我的学习会话",
  "output_language": "Simplified Chinese"
}
```

**请求字段**:
- `profile_id` (string, 必需): 要使用的 Profile ID
- `session_name` (string, 可选): 会话名称，默认为 "新会话"
- `output_language` (string, 可选): 输出语言，默认为 "Simplified Chinese"

**响应**:
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**错误响应**:
- `404`: Profile 不存在

**说明**: 
- 创建后会自动保存到磁盘
- Session 保存位置: `data/session_data/{session_id}.json`

### 5.3 获取 Session 详情

#### GET /api/sessions/{session_id}

获取一个会话的详细信息，包括完整的对话历史。

**路径参数**:
- `session_id` (string): Session 的唯一标识符

**响应**: `Session`

**响应示例**:
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "session_name": "我的学习会话",
  "profile": { ... },
  "state": {
    "stepIndex": 3
  },
  "create_at": "2025-01-15T11:00:00Z",
  "update_at": "2025-01-15T11:30:00Z",
  "output_language": "Simplified Chinese",
  "history": [
    {
      "type": "ai",
      "content": "欢迎来到..."
    },
    {
      "type": "human",
      "content": "什么是缓冲区溢出？"
    }
  ]
}
```

**错误响应**:
- `404`: Session 不存在

### 5.4 重命名 Session

#### PUT /api/sessions/{session_id}/rename

重命名一个会话。

**路径参数**:
- `session_id` (string): Session 的唯一标识符

**请求体**: `RenameSessionRequest`

```json
{
  "session_name": "新的会话名称"
}
```

**响应**:
```json
{
  "success": true,
  "message": "会话重命名成功"
}
```

**错误响应**:
- `404`: Session 不存在

**说明**: 重命名后会清除内存缓存

### 5.5 删除 Session

#### DELETE /api/sessions/{session_id}

删除一个会话。

**路径参数**:
- `session_id` (string): Session 的唯一标识符

**响应**:
```json
{
  "success": true,
  "message": "会话删除成功"
}
```

**说明**: 
- 删除后会清除内存缓存
- 文件从 `data/session_data/{session_id}.json` 删除

---

## 6. 交互 API

### 6.1 获取欢迎消息

#### GET /api/tutor/{session_id}/welcome

获取会话的欢迎消息。

**路径参数**:
- `session_id` (string): Session 的唯一标识符

**响应**:
```json
{
  "welcome": "欢迎来到缓冲区溢出攻击的学习！我是你的导师..."
}
```

**错误响应**:
- `404`: Session 不存在
- `500`: 内部错误

### 6.2 获取会话状态

#### GET /api/tutor/{session_id}/state

获取会话的当前进度状态。

**路径参数**:
- `session_id` (string): Session 的唯一标识符

**响应**:
```json
{
  "stepIndex": 3,
  "totalSteps": 5,
  "isFinished": false
}
```

**响应字段**:
- `stepIndex` (number): 当前步骤索引（从1开始）
- `totalSteps` (number): 总步骤数
- `isFinished` (boolean): 是否已完成所有步骤

**错误响应**:
- `404`: Session 不存在
- `500`: 内部错误

### 6.3 发送消息（流式响应）

#### POST /api/sessions/{session_id}/messages/stream

发送消息并异步获取流式回复。

**路径参数**:
- `session_id` (string): Session 的唯一标识符

**请求体**: `MessageRequest`

```json
{
  "message": "base64编码的消息内容"
}
```

**请求字段**:
- `message` (string, 必需): Base64 编码的用户消息

**响应**: Server-Sent Events (SSE) 流

**响应格式**:
```
data: {"type": "token", "data": "部分回复内容"}

data: {"type": "token", "data": "更多内容"}

data: {"type": "END", "data": {"reply": "完整回复", "state": {"stepIndex": 3}, "is_finished": false}}

```

**事件类型**:
- `token`: 流式输出的文本片段
- `END`: 流式输出结束，包含完整回复和状态
- `error`: 错误信息

**错误响应**:
- `404`: Session 不存在
- `500`: 内部错误

**说明**:
- 消息使用 Base64 编码以防止特殊字符问题
- 响应使用 SSE 格式，客户端需要支持流式接收
- 每次交互后会自动保存会话状态

---

## 7. OpenAI 适配器 API

### 7.1 流式聊天完成（OpenAI 兼容）

#### POST /v1/chat/completions

模拟 OpenAI 的流式聊天接口，用于兼容 OpenAI 客户端。

**请求头**:
- `Authorization`: `Bearer {session_id}` (必需)

**请求体**: `OpenAIRequest`

```json
{
  "messages": [
    {
      "role": "user",
      "content": "什么是缓冲区溢出？"
    }
  ],
  "model": "gpt-4",
  "stream": true
}
```

**请求字段**:
- `messages` (array, 必需): 消息列表，会提取最后一个 user 角色的消息
- `model` (string, 可选): 模型标识符（此适配器中忽略）
- `stream` (boolean, 可选): 是否流式输出，默认为 true

**响应**: Server-Sent Events (SSE) 流，OpenAI 格式

**响应格式**:
```
data: {"id": "chatcmpl-xxx", "object": "chat.completion.chunk", "created": 1234567890, "model": "profile_id", "choices": [{"index": 0, "delta": {"content": "部分内容"}, "finish_reason": null}]}

data: {"id": "chatcmpl-xxx", "object": "chat.completion.chunk", "created": 1234567890, "model": "profile_id", "choices": [{"index": 0, "delta": {"content": "更多内容"}, "finish_reason": null}]}

data: {"id": "chatcmpl-xxx", "object": "chat.completion.chunk", "created": 1234567890, "model": "profile_id", "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}

data: [DONE]
```

**错误响应**:
- `401`: Authorization 头格式错误
- `400`: 未找到用户消息
- `404`: Session 不存在（通过错误 chunk 返回）

**说明**:
- 此端点用于兼容 OpenAI API 格式
- `session_id` 通过 Authorization 头的 Bearer token 传递
- 响应格式完全兼容 OpenAI 的流式响应格式

---

## 8. 数据模型定义

### 8.1 Profile

```typescript
interface Profile {
  profile_id: string;           // UUID
  profile_name?: string;         // 配置名称，如果为空则使用 topic_name
  topic_name: string;            // 主题名称
  persona_hints: string[];       // 人设提示列表
  target_audience: string;       // 目标受众
  curriculum: SocraticCurriculum; // 教学大纲
  prompt_template: string;       // 提示词模板
  create_at: string;             // ISO 8601 时间戳
}
```

### 8.2 Session

```typescript
interface SessionHistoryMessage {
  type: "human" | "ai";          // 消息类型，"human" 表示用户消息，"ai" 表示助手消息
  content: string;               // 消息内容
  timestamp?: string;            // 可选的时间戳
}

interface Session {
  session_id: string;            // UUID（不可变）
  session_name: string;           // 会话名称
  profile: Profile;              // 关联的 Profile
  state: SessionState;           // 会话状态
  create_at: string;             // ISO 8601 时间戳
  update_at: string;             // ISO 8601 时间戳
  output_language: string;       // 输出语言
  history: SessionHistoryMessage[]; // 对话历史
}
```

### 8.3 SessionSummary

```typescript
interface SessionSummary {
  session_id: string;
  session_name: string;
  profile_id: string;
  profile_name: string;
  topic_name: string;
  create_at: string;
  update_at: string;
}
```

### 8.4 SessionState

```typescript
interface SessionState {
  stepIndex: number;             // 当前步骤索引（从1开始）
}
```

**注意**: `Session` 模型中的 `state` 字段只包含 `stepIndex`。而 `/api/tutor/{session_id}/state` 端点返回的完整状态包含 `stepIndex`、`totalSteps` 和 `isFinished`。

### 8.5 CreateSessionRequest

```typescript
interface CreateSessionRequest {
  profile_id: string;            // 必需
  session_name?: string;         // 可选，默认 "新会话"
  output_language?: string;       // 可选，默认 "Simplified Chinese"
}
```

### 8.6 MessageRequest

```typescript
interface MessageRequest {
  message: string;               // Base64 编码的消息
}
```

### 8.7 RenameSessionRequest

```typescript
interface RenameSessionRequest {
  session_name: string;          // 新的会话名称
}
```

### 8.8 ResponseMessage

```typescript
interface ResponseMessage {
  reply: string;                 // 导师的回复
  state: SessionState;           // 更新后的状态
  is_finished: boolean;          // 是否完成所有步骤
}
```

---

## 9. Profile 保存位置说明

### 9.1 Profile 文件存储

**目录路径**: `data/tutor_profiles/`

**文件命名规则**: `{profile_id}.json`

**完整路径示例**: 
- `data/tutor_profiles/550e8400-e29b-41d4-a716-446655440000.json`
- `data/tutor_profiles/example/profile_id.json` (如果按主题组织)

**文件格式**: JSON，符合 `Profile` 数据模型

### 9.2 Profile 生成流程

Profile 通过 CLI 工具 (`src/main.py`) 生成：

1. **输入**: `data_raw/{lab_name}/lab_manual.md`
2. **生成**: Persona 和 Curriculum
3. **中间产物**: 
   - `data_raw/{lab_name}/definition.json` (Persona)
   - `data_raw/{lab_name}/curriculum.json` (Curriculum)
4. **最终产物**: `data/tutor_profiles/{lab_name}/{profile_id}.json`

### 9.3 Profile 目录结构

```
data/
└── tutor_profiles/
    ├── example/
    │   └── {profile_id}.json
    ├── Race-Condition/
    │   └── {profile_id}.json
    ├── seed_buffer_overflow/
    │   └── {profile_id}.json
    └── ...
```

**注意**: ProfileManager 会扫描 `data/tutor_profiles/` 目录下的所有 `.json` 文件，包括子目录中的文件。

---

## 10. Session 保存位置说明

### 10.1 Session 文件存储

**目录路径**: `data/session_data/`

**文件命名规则**: `{session_id}.json`

**完整路径示例**: 
- `data/session_data/660e8400-e29b-41d4-a716-446655440001.json`

**文件格式**: JSON，符合 `Session` 数据模型

### 10.2 Session 生命周期

1. **创建**: 通过 `POST /api/sessions/create` 创建，立即保存到磁盘
2. **更新**: 每次消息交互后自动更新 `update_at` 和 `history`
3. **删除**: 通过 `DELETE /api/sessions/{session_id}` 删除文件

---

## 11. 错误码说明

| HTTP 状态码 | 说明 | 示例场景 |
|------------|------|---------|
| 200 | 成功 | 请求处理成功 |
| 400 | 请求错误 | 请求参数格式错误 |
| 401 | 未授权 | Authorization 头格式错误 |
| 404 | 资源未找到 | Profile 或 Session 不存在 |
| 500 | 服务器错误 | 内部处理错误 |

---

## 12. 使用示例

### 12.1 完整流程示例

```bash
# 1. 获取所有可用的 Profile
curl http://localhost:8000/api/profiles

# 2. 创建新 Session
curl -X POST http://localhost:8000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_name": "我的学习会话",
    "output_language": "Simplified Chinese"
  }'

# 3. 获取欢迎消息
curl http://localhost:8000/api/tutor/{session_id}/welcome

# 4. 发送消息（流式）
curl -X POST http://localhost:8000/api/sessions/{session_id}/messages/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "'$(echo -n "什么是缓冲区溢出？" | base64)'"
  }'

# 5. 获取会话状态
curl http://localhost:8000/api/tutor/{session_id}/state

# 6. 获取会话详情
curl http://localhost:8000/api/sessions/{session_id}
```

### 12.2 JavaScript/TypeScript 示例

```typescript
// 创建 Session
const createSession = async (profileId: string) => {
  const response = await fetch('http://localhost:8000/api/sessions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_id: profileId,
      session_name: '我的学习会话',
      output_language: 'Simplified Chinese'
    })
  });
  return await response.json();
};

// 发送消息（流式）
const sendMessage = async (sessionId: string, message: string) => {
  const encodedMessage = btoa(unescape(encodeURIComponent(message)));
  const response = await fetch(
    `http://localhost:8000/api/sessions/${sessionId}/messages/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: encodedMessage })
    }
  );
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'token') {
          console.log('Token:', data.data);
        } else if (data.type === 'END') {
          console.log('Complete:', data.data);
        }
      }
    }
  }
};
```

---

## 13. 注意事项

1. **Base64 编码**: 发送消息时需要使用 Base64 编码
2. **流式响应**: 交互 API 使用 SSE 格式，需要客户端支持流式接收
3. **Session ID**: Session ID 在创建后不可更改
4. **缓存**: Tutor 实例在内存中缓存，删除或重命名 Session 会清除缓存
5. **历史截断**: 对话历史超过 `MAX_HISTORY_TOKENS` 时会自动截断
6. **时区**: 所有时间戳使用 UTC 时区

---

## 14. API 版本

当前 API 版本: **2.0.0**

API 版本信息可通过访问 `/docs` 端点查看。


