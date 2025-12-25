/**
 * Header component for the main application header.
 *
 * This component displays session information and controls.
 */

import React from 'react';
import {Maximize2, Minimize2} from 'lucide-react';
import {SessionSummary, SocraticStep, User} from '../types';
import {ProgressBar} from './ProgressBar';

/**
 * Props for Header component.
 */
export interface HeaderProps {
  readonly currentSession: SessionSummary | null;
  readonly isMaximized: boolean;
  readonly isCollapsed: boolean;
  readonly currentStep: number;
  readonly curriculum: readonly SocraticStep[];
  readonly onToggleMaximize: () => void;
  readonly onToggleCollapse: () => void;
  readonly user: User | null;
}

/**
 * Header component for the main application header.
 *
 * @param props - Component props
 * @returns React component
 */
export function Header(props: HeaderProps): JSX.Element {
  const {
    currentSession,
    isMaximized,
    isCollapsed,
    currentStep,
    curriculum,
    onToggleMaximize,
    onToggleCollapse,
    user,
  } = props;

  return (
    <header className="border-b bg-white">
      <div
        className={`${isMaximized ? '' : 'max-w-4xl mx-auto'} flex items-center justify-between p-4`}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            {currentSession
              ? currentSession.session_name
              : '苏格拉底式AI导师'}
          </h1>

          {/* Collapse/Expand Button */}
          {currentSession && (
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={isCollapsed ? '展开信息' : '收起信息'}
            >
              {isCollapsed ? (
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Maximize/Restore Button */}
        {currentSession && (
          <button
            onClick={onToggleMaximize}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isMaximized ? '还原窗口' : '最大化对话'}
          >
            {isMaximized ? (
              <Minimize2 className="w-5 h-5 text-gray-600" />
            ) : (
              <Maximize2 className="w-5 h-5 text-gray-600" />
            )}
          </button>
        )}
      </div>

      {/* Collapsible Info Area */}
      {!isCollapsed && (
        <div
          className={`${isMaximized ? '' : 'max-w-4xl mx-auto'} px-4 pb-4 transition-all duration-300 ease-in-out`}
        >
          <p className="text-sm text-gray-600 mb-4">
            {currentSession
              ? `课程: ${currentSession.topic_name} | Profile: ${currentSession.profile_id}`
              : '通过提问启发思考，引导深度学习'}
          </p>

          {/* Progress Bar */}
          {currentSession && curriculum.length > 0 && (
            <ProgressBar currentStep={currentStep} curriculum={curriculum} />
          )}
        </div>
      )}
    </header>
  );
}

