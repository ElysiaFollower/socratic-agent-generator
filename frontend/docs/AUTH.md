# 前端鉴权系统文档

## 概述

本系统实现了基于角色的访问控制（RBAC），支持三种用户角色：
- **管理员（admin）**：拥有所有权限
- **教师（teacher）**：可以上传实验文档、生成persona和curriculum并编辑、生成Profile、和自己发布的导师对话，但不能阅读学生的对话记录
- **学生（student）**：可以和教师发布的导师对话，每个学生独享自己的会话记录

## 架构设计

### 1. 类型定义

所有鉴权相关的类型定义在 `src/types/index.ts` 中：

```typescript
export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  readonly user_id: string;
  readonly username: string;
  readonly role: UserRole;
  readonly display_name?: string;
  readonly email?: string;
}
```

### 2. API 服务

鉴权API服务位于 `src/api/auth.ts`，提供以下功能：

- `login(credentials)`: 用户登录
- `logout()`: 用户登出
- `getCurrentUser()`: 获取当前用户信息
- `getAuthToken()`: 获取存储的认证token
- `setAuthToken(token)`: 设置认证token
- `removeAuthToken()`: 移除认证token

### 3. 认证上下文

`AuthContext` (`src/contexts/AuthContext.tsx`) 提供全局认证状态管理：

- `user`: 当前用户信息
- `isLoading`: 认证状态加载中
- `isAuthenticated`: 是否已认证
- `login(credentials)`: 登录方法
- `logout()`: 登出方法
- `refreshUser()`: 刷新用户信息
- `hasRole(role)`: 检查用户是否有特定角色
- `hasAnyRole(roles)`: 检查用户是否有任一角色

### 4. 组件

#### Login 组件

登录表单组件，位于 `src/components/Login.tsx`。

#### ProtectedRoute 组件

路由保护组件，位于 `src/components/ProtectedRoute.tsx`：

```tsx
<ProtectedRoute requiredRoles={['admin', 'teacher']}>
  <YourComponent />
</ProtectedRoute>
```

#### PermissionGuard 组件

权限守卫组件，位于 `src/components/PermissionGuard.tsx`，用于条件渲染：

```tsx
<PermissionGuard requiredRoles={['admin', 'teacher']}>
  <TeacherOnlyComponent />
</PermissionGuard>
```

## 使用方式

### 1. 在应用中使用认证

应用已通过 `AuthProvider` 包裹，在 `main.tsx` 中：

```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

### 2. 在组件中使用认证

```tsx
import {useAuth} from './hooks';

function MyComponent() {
  const {user, isAuthenticated, hasRole, logout} = useAuth();
  
  if (!isAuthenticated) {
    return <Login />;
  }
  
  return (
    <div>
      <p>欢迎, {user?.username}</p>
      {hasRole('admin') && <AdminPanel />}
      <button onClick={logout}>登出</button>
    </div>
  );
}
```

### 3. 权限控制

#### 路由保护

```tsx
<ProtectedRoute requiredRoles={['admin']}>
  <AdminDashboard />
</ProtectedRoute>
```

#### 条件渲染

```tsx
<PermissionGuard requiredRoles={['teacher', 'admin']}>
  <TeacherTools />
</PermissionGuard>
```

## API 端点要求

前端期望后端提供以下API端点：

### POST /api/auth/login

登录接口

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
    "email": "string"
  },
  "token": "string"
}
```

### POST /api/auth/logout

登出接口

**请求头：**
```
Authorization: Bearer <token>
```

### GET /api/auth/me

获取当前用户信息

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
    "email": "string"
  }
}
```

## 权限说明

### 管理员（admin）

- ✅ 所有权限
- ✅ 查看所有会话
- ✅ 管理所有用户
- ✅ 上传实验文档
- ✅ 生成和编辑Profile
- ✅ 查看所有对话记录

### 教师（teacher）

- ✅ 上传实验文档
- ✅ 生成persona和curriculum并编辑
- ✅ 生成Profile
- ✅ 和自己发布的导师对话
- ❌ 不能阅读学生的对话记录
- ❌ 不能管理其他用户

### 学生（student）

- ✅ 和教师发布的导师对话
- ✅ 独享自己的会话记录
- ❌ 不能上传文档
- ❌ 不能生成Profile
- ❌ 不能查看其他学生的会话

## 注意事项

1. **Token存储**：认证token存储在localStorage中，页面刷新后仍然有效。

2. **自动认证**：应用启动时会自动尝试从localStorage恢复认证状态。

3. **API请求拦截**：所有API请求会自动添加 `Authorization: Bearer <token>` 头。

4. **会话过滤**：目前前端显示所有会话。要实现基于角色的会话过滤，需要后端在 `SessionSummary` 中添加 `creator_id` 或 `user_id` 字段。

5. **教师功能**：Sidebar中显示的"上传实验文档"和"生成Profile"按钮目前是占位符，需要后端实现相应的API端点。

## 后续改进

1. **后端支持**：
   - 实现用户认证API端点
   - 在Session和Profile中添加创建者信息
   - 实现基于角色的数据过滤

2. **功能完善**：
   - 实现教师上传文档功能
   - 实现Profile生成界面
   - 实现会话权限检查

3. **安全性**：
   - Token刷新机制
   - 更严格的权限验证
   - 会话超时处理


