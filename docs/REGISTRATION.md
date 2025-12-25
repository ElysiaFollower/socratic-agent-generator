# 用户注册功能文档

## 概述

本系统实现了基于角色的用户注册功能，支持三种用户角色：
- **管理员（admin）**：需要管理员令牌（ADMIN_TOKEN）
- **教师（teacher）**：需要管理员提供的邀请码
- **学生（student）**：需要教师或管理员提供的邀请码

## 后端配置

### 1. 环境变量配置

在 `.env` 文件中配置以下变量：

```bash
# 管理员注册令牌（必需，用于注册管理员账户）
ADMIN_TOKEN=your-secret-admin-token-here

# JWT密钥（可选，默认值仅用于开发环境）
JWT_SECRET_KEY=your-secret-jwt-key-change-in-production
```

### 2. 安装依赖

确保安装了以下Python包：

```bash
pip install passlib[bcrypt] python-jose[cryptography]
```

## 用户注册流程

### 管理员注册

1. 在 `.env` 文件中设置 `ADMIN_TOKEN`
2. 访问注册页面
3. 选择"管理员"身份
4. 输入管理员令牌（从 `.env` 文件获取）
5. 填写用户名、密码等信息
6. 提交注册

### 教师注册

1. 管理员通过前端界面生成教师邀请码（见下方"生成邀请码"部分）
2. 访问注册页面
3. 选择"教师"身份
4. 输入邀请码
5. 填写用户名、密码等信息
6. 提交注册

### 学生注册

1. 教师或管理员通过前端界面生成学生邀请码（见下方"生成邀请码"部分）
2. 访问注册页面
3. 选择"学生"身份
4. 输入邀请码
5. 填写用户名、密码等信息
6. 提交注册

## 生成邀请码

### 使用前端界面生成邀请码

管理员和教师可以通过前端界面直接生成邀请码：

1. **登录系统**：使用管理员或教师账户登录
2. **打开生成界面**：在侧边栏的"管理员功能"或"教师功能"区域，点击"生成邀请码"按钮
3. **选择角色**：
   - **管理员**：可以为教师或学生生成邀请码
   - **教师**：只能为学生生成邀请码
4. **设置有效期**：选择邀请码的有效期（1-365天，默认30天）
5. **生成并复制**：点击"生成邀请码"按钮，系统会生成邀请码并显示，可以一键复制到剪贴板

### 权限说明

- **管理员**：可以为教师和学生生成邀请码
- **教师**：只能为学生生成邀请码
- **学生**：无权限生成邀请码

## API端点

### POST /api/auth/register

注册新用户。

**请求体：**
```json
{
  "username": "string",
  "password": "string",
  "role": "admin" | "teacher" | "student",
  "display_name": "string (optional)",
  "email": "string (optional)",
  "admin_token": "string (required for admin)",
  "invitation_code": "string (required for teacher/student)"
}
```

**响应：**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user_id": "uuid"
}
```

**错误响应：**
- `400`: 请求参数错误（角色无效、缺少必需字段等）
- `403`: 管理员令牌无效
- `409`: 用户名已存在
- `500`: 服务器配置错误（ADMIN_TOKEN未设置）

### POST /api/auth/login

用户登录。

**请求体：**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应：**
```json
{
  "user": {
    "user_id": "string",
    "username": "string",
    "role": "admin" | "teacher" | "student",
    "display_name": "string",
    "email": "string",
    "create_at": "ISO 8601 timestamp"
  },
  "token": "JWT token"
}
```

### GET /api/auth/me

获取当前用户信息（需要认证）。

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "user": {
    "user_id": "string",
    "username": "string",
    "role": "admin" | "teacher" | "student",
    "display_name": "string",
    "email": "string",
    "create_at": "ISO 8601 timestamp"
  }
}
```

### POST /api/auth/invitation-codes/generate

生成邀请码（需要认证，管理员或教师权限）。

**请求头：**
```
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "role": "teacher" | "student",
  "expires_in_days": 30
}
```

**响应：**
```json
{
  "invitation_code": "string",
  "role": "teacher" | "student",
  "created_by": "string",
  "expires_in_days": 30,
  "expires_at": "ISO 8601 timestamp"
}
```

**权限要求：**
- 管理员：可以为教师和学生生成邀请码
- 教师：只能为学生生成邀请码
- 学生：无权限

**错误响应：**
- `400`: 请求参数错误（角色无效、有效期超出范围等）
- `403`: 权限不足（学生尝试生成邀请码，或教师尝试为教师生成邀请码）
- `401`: 未认证

## 数据存储

### 用户数据

用户数据存储在：`data/users/users.json`

文件格式：
```json
{
  "username1": {
    "user_id": "uuid",
    "username": "username1",
    "password_hash": "bcrypt hash",
    "role": "admin",
    "display_name": "Display Name",
    "email": "email@example.com",
    "create_at": "ISO 8601 timestamp"
  }
}
```

### 邀请码数据

邀请码数据存储在：`data/users/invitation_codes/codes.json`

文件格式：
```json
{
  "invitation_code": {
    "role": "teacher" | "student",
    "created_by": "username",
    "created_at": "ISO 8601 timestamp",
    "expires_at": "ISO 8601 timestamp",
    "used": false
  }
}
```

## 安全注意事项

1. **管理员令牌**：
   - 必须设置强密码
   - 不要提交到版本控制系统
   - 定期更换

2. **JWT密钥**：
   - 生产环境必须设置强密钥
   - 不要使用默认值

3. **密码安全**：
   - 密码使用bcrypt哈希存储
   - 前端应实施密码强度要求（至少6位）

4. **邀请码**：
   - 邀请码使用安全的随机生成
   - 每个邀请码只能使用一次
   - 邀请码有过期时间

## 故障排除

### 管理员注册失败

- 检查 `.env` 文件中是否设置了 `ADMIN_TOKEN`
- 确认提供的管理员令牌与 `.env` 文件中的值完全一致

### 教师/学生注册失败

- 确认邀请码正确输入（区分大小写）
- 检查邀请码是否已过期
- 确认邀请码是否已被使用
- 确认邀请码的角色与注册角色匹配

### 用户名已存在

- 选择不同的用户名
- 或使用现有账户登录

## 后续改进

1. **邀请码管理界面**：
   - 查看已生成的邀请码列表
   - 查看邀请码使用情况
   - 撤销未使用的邀请码

2. **密码重置**：
   - 实现密码重置功能
   - 通过邮箱验证

3. **账户管理**：
   - 用户信息编辑
   - 密码修改
   - 账户删除

4. **审计日志**：
   - 记录注册和登录活动
   - 跟踪邀请码使用


