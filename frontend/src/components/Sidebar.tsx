/**
 * Sidebar component for session list and navigation.
 *
 * This component displays the list of sessions and provides
 * controls for creating new sessions and managing existing ones.
 */

import React from 'react';
import {SessionSummary, User} from '../types';
import {PermissionGuard} from './PermissionGuard';

/**
 * Props for Sidebar component.
 */
export interface SidebarProps {
  readonly sessions: readonly SessionSummary[];
  readonly currentSessionId: string | null;
  readonly isLoading: boolean;
  readonly onNewSession: () => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onRenameSession: (sessionId: string, newName: string) => void;
  readonly onDeleteSession: (sessionId: string) => void;
  readonly user: User | null;
  readonly onLogout: () => void;
}

/**
 * Sidebar component for session management.
 *
 * @param props - Component props
 * @returns React component
 */
export function Sidebar(props: SidebarProps): JSX.Element {
  const {
    sessions,
    currentSessionId,
    isLoading,
    onNewSession,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    user,
    onLogout,
  } = props;

  const [editingSessionId, setEditingSessionId] = React.useState<
    string | null
  >(null);
  const [editingName, setEditingName] = React.useState<string>('');

  const handleRename = (sessionId: string, newName: string) => {
    if (newName.trim()) {
      onRenameSession(sessionId, newName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleDelete = (sessionId: string) => {
    if (window.confirm('确定要删除这个会话吗？')) {
      onDeleteSession(sessionId);
    }
  };

  const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      teacher: '教师',
      student: '学生',
    };
    return roleMap[role] || role;
  };

  return (
    <aside className="w-80 bg-white border-r flex flex-col">
      {/* User Info */}
      {user && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.display_name || user.username}
              </p>
              <p className="text-xs text-gray-500">
                {getRoleDisplayName(user.role)}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="ml-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
              title="登出"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Admin/Teacher Management Section */}
      <PermissionGuard requiredRoles={['admin', 'teacher']}>
        <div className="p-4 border-b bg-indigo-50">
          <h3 className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2">
            {user?.role === 'admin' ? '管理员功能' : '教师功能'}
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                const event = new CustomEvent('openInvitationGenerator');
                window.dispatchEvent(event);
              }}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              disabled={isLoading}
              title="生成邀请码"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              生成邀请码
            </button>
            <button
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              disabled={isLoading}
              title="上传实验文档功能（待实现）"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              上传实验文档
            </button>
            <button
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              disabled={isLoading}
              title="生成Profile功能（待实现）"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              生成Profile
            </button>
          </div>
        </div>
      </PermissionGuard>

      {/* New Session Button */}
      <div className="p-4 border-b">
        <button
          onClick={onNewSession}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
          disabled={isLoading}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          新建会话
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">历史会话</h3>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors group ${
                  currentSessionId === session.session_id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => onSelectSession(session)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.session_id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() =>
                          handleRename(session.session_id, editingName)
                        }
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleRename(session.session_id, editingName);
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h4 className="font-medium text-gray-900 truncate">
                        {session.session_name}
                      </h4>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {session.topic_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSessionId(session.session_id);
                        setEditingName(session.session_name);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                      title="重命名"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(session.session_id);
                      }}
                      className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                      title="删除"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm">还没有任何会话</p>
                <p className="text-xs mt-1">点击上方按钮开始新的学习之旅</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

