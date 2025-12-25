/**
 * Login component.
 *
 * This component provides a login form for user authentication,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent} from 'react';
import {useAuth} from '../hooks';
import {LoginRequest} from '../types';

/**
 * Props for Login component.
 */
interface LoginProps {
  readonly onLoginSuccess?: () => void;
  readonly onSwitchToRegister?: () => void;
}

/**
 * Login form component.
 *
 * @param props - Component props
 * @returns React component
 */
export function Login(props: LoginProps): JSX.Element {
  const {onLoginSuccess, onSwitchToRegister} = props;
  const {login, isLoading} = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    try {
      const credentials: LoginRequest = {
        username: username.trim(),
        password,
      };
      await login(credentials);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '登录失败，请重试';
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录到苏格拉底式AI导师系统
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            请输入您的用户名和密码
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
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>

            {onSwitchToRegister && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                  disabled={isLoading}
                >
                  还没有账户？立即注册
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

