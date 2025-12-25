/**
 * Register component.
 *
 * This component provides a registration form for new users,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent} from 'react';
import {useAuth} from '../hooks';
import {RegisterRequest, UserRole} from '../types';
import {register as apiRegister} from '../api';

/**
 * Props for Register component.
 */
interface RegisterProps {
  readonly onRegisterSuccess?: () => void;
  readonly onSwitchToLogin?: () => void;
}

/**
 * Register form component.
 *
 * @param props - Component props
 * @returns React component
 */
export function Register(props: RegisterProps): JSX.Element {
  const {onRegisterSuccess, onSwitchToLogin} = props;
  const {login} = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('student');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [adminToken, setAdminToken] = useState<string>('');
  const [invitationCode, setInvitationCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Validation
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }
    if (role === 'admin' && !adminToken.trim()) {
      setError('注册管理员需要提供管理员令牌');
      return;
    }
    if (role !== 'admin' && !invitationCode.trim()) {
      setError(`注册${role === 'teacher' ? '教师' : '学生'}需要提供邀请码`);
      return;
    }

    setIsLoading(true);
    try {
      const request: RegisterRequest = {
        username: username.trim(),
        password,
        role,
        display_name: displayName.trim() || undefined,
        email: email.trim() || undefined,
        admin_token: role === 'admin' ? adminToken.trim() : undefined,
        invitation_code:
          role !== 'admin' ? invitationCode.trim() : undefined,
      };

      await apiRegister(request);

      // Auto login after successful registration
      try {
        await login({
          username: username.trim(),
          password,
        });
        if (onRegisterSuccess) {
          onRegisterSuccess();
        }
      } catch (loginError) {
        // Registration succeeded but login failed
        const loginErrorMessage =
          loginError instanceof Error
            ? loginError.message
            : '注册成功，但自动登录失败，请手动登录';
        setError(loginErrorMessage);
        // Still switch to login page after a delay
        setTimeout(() => {
          if (onSwitchToLogin) {
            onSwitchToLogin();
          }
        }, 2000);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '注册失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            注册新账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            创建您的账户以开始使用
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                用户名 *
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码 *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                确认密码 *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                身份 *
              </label>
              <select
                id="role"
                name="role"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={isLoading}
              >
                <option value="student">学生</option>
                <option value="teacher">教师</option>
                <option value="admin">管理员</option>
              </select>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                显示名称
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="显示名称（可选）"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="邮箱地址（可选）"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Admin Token */}
            {role === 'admin' && (
              <div>
                <label htmlFor="adminToken" className="block text-sm font-medium text-gray-700">
                  管理员令牌 *
                </label>
                <input
                  id="adminToken"
                  name="adminToken"
                  type="password"
                  required={role === 'admin'}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="管理员令牌（从.env文件获取）"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Invitation Code */}
            {role !== 'admin' && (
              <div>
                <label htmlFor="invitationCode" className="block text-sm font-medium text-gray-700">
                  邀请码 * {role === 'teacher' ? '（需要管理员提供）' : '（需要教师或管理员提供）'}
                </label>
                <input
                  id="invitationCode"
                  name="invitationCode"
                  type="text"
                  required={role !== 'admin'}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="邀请码"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '注册中...' : '注册'}
            </button>

            {onSwitchToLogin && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                  disabled={isLoading}
                >
                  已有账户？立即登录
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}


