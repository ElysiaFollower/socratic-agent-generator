/**
 * Invitation code generator component.
 *
 * This component provides a UI for generating invitation codes,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent} from 'react';
import {useAuth} from '../hooks';
import {GenerateInvitationCodeRequest, UserRole} from '../types';
import {generateInvitationCode} from '../api';

/**
 * Props for InvitationCodeGenerator component.
 */
interface InvitationCodeGeneratorProps {
  readonly onClose?: () => void;
}

/**
 * Invitation code generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function InvitationCodeGenerator(
  props: InvitationCodeGeneratorProps,
): JSX.Element {
  const {onClose} = props;
  const {user} = useAuth();
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeDetails, setCodeDetails] = useState<{
    role: string;
    expiresAt: string;
  } | null>(null);

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setGeneratedCode(null);
    setCodeDetails(null);

    // Check permissions
    if (user?.role === 'teacher' && role === 'teacher') {
      setError('教师只能为学生生成邀请码');
      return;
    }

    setIsLoading(true);
    try {
      const request: GenerateInvitationCodeRequest = {
        role,
        expires_in_days: expiresInDays,
      };
      const response = await generateInvitationCode(request);
      setGeneratedCode(response.invitation_code);
      setCodeDetails({
        role: response.role === 'teacher' ? '教师' : '学生',
        expiresAt: new Date(response.expires_at).toLocaleString('zh-CN'),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成邀请码失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Copies invitation code to clipboard.
   */
  const copyToClipboard = async () => {
    if (generatedCode) {
      try {
        await navigator.clipboard.writeText(generatedCode);
        // Show temporary success message
        const button = document.getElementById('copy-button');
        if (button) {
          const originalText = button.textContent;
          button.textContent = '已复制！';
          setTimeout(() => {
            if (button) {
              button.textContent = originalText;
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">生成邀请码</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
              role="alert"
            >
              {error}
            </div>
          )}

          {generatedCode ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-2">
                  邀请码生成成功！
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600">角色</label>
                    <p className="text-sm font-medium">{codeDetails?.role}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">过期时间</label>
                    <p className="text-sm font-medium">{codeDetails?.expiresAt}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邀请码
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedCode}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                  />
                  <button
                    id="copy-button"
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    复制
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  请妥善保管此邀请码，它将用于{codeDetails?.role}注册。
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setGeneratedCode(null);
                    setCodeDetails(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  生成新的
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    完成
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  角色 *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as 'teacher' | 'student')
                  }
                  disabled={isLoading || user?.role === 'teacher'}
                >
                  {user?.role === 'admin' && (
                    <option value="teacher">教师</option>
                  )}
                  <option value="student">学生</option>
                </select>
                {user?.role === 'teacher' && (
                  <p className="mt-1 text-xs text-gray-500">
                    教师只能为学生生成邀请码
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="expiresInDays"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  有效期（天）*
                </label>
                <input
                  id="expiresInDays"
                  name="expiresInDays"
                  type="number"
                  required
                  min={1}
                  max={365}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  邀请码将在指定天数后过期（1-365天）
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    disabled={isLoading}
                  >
                    取消
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '生成中...' : '生成邀请码'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

