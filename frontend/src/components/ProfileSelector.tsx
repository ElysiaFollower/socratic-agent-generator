/**
 * ProfileSelector component for selecting a profile to start a session.
 *
 * This component displays a modal with available profiles for selection.
 */

import React from 'react';
import {Profile} from '../types';
import {extractCurriculumSteps} from '../utils/curriculum';

/**
 * Props for ProfileSelector component.
 */
export interface ProfileSelectorProps {
  readonly profiles: readonly Profile[];
  readonly isLoading: boolean;
  readonly onSelect: (profile: Profile) => void;
  readonly onClose: () => void;
}

/**
 * ProfileSelector component for selecting a profile.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileSelector(props: ProfileSelectorProps): JSX.Element {
  const {profiles, isLoading, onSelect, onClose} = props;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-6">选择学习课程</h2>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <button
                key={profile.profile_id}
                onClick={() => onSelect(profile)}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors hover:border-blue-300 hover:shadow-md"
                disabled={isLoading}
              >
                <div className="font-semibold text-lg mb-2 text-gray-900">
                  {profile.profile_name || profile.topic_name}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">目标受众:</span>{' '}
                  {profile.target_audience}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">课程主题:</span>{' '}
                  {profile.topic_name}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="font-medium">学习步骤:</span>{' '}
                  {extractCurriculumSteps(profile.curriculum).length} 个步骤
                </div>
              </button>
            ))}
          </div>

          {profiles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p className="text-lg">暂无可用的课程配置</p>
              <p className="text-sm mt-1">请联系管理员添加学习课程</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

