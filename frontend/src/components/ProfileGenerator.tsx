/**
 * Profile generator component.
 *
 * This component provides a UI for generating tutor profiles from lab manuals,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent, ChangeEvent} from 'react';
import {generateProfile, type GenerateProfileRequest} from '../api';
import {Profile} from '../types';

/**
 * Props for ProfileGenerator component.
 */
interface ProfileGeneratorProps {
  readonly labManualContent?: string;
  readonly labManualFilename?: string | null;
  readonly onGenerateSuccess?: (profile: Profile) => void;
  readonly onClose?: () => void;
}

/**
 * Profile generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileGenerator(
  props: ProfileGeneratorProps,
): JSX.Element {
  const {labManualContent, labManualFilename, onGenerateSuccess, onClose} =
    props;
  const [content, setContent] = useState<string>(labManualContent || '');
  const [profileName, setProfileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedProfile, setGeneratedProfile] = useState<Profile | null>(
    null,
  );

  /**
   * Handles content change.
   *
   * @param event - Textarea change event
   */
  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    setError(null);
  };

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!content.trim()) {
      setError('实验文档内容不能为空');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const request: GenerateProfileRequest = {
        lab_manual_content: content,
        profile_name: profileName.trim() || undefined,
        filename: labManualFilename || undefined,
      };
      const profile = await generateProfile(request);
      setGeneratedProfile(profile);
      if (onGenerateSuccess) {
        onGenerateSuccess(profile);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles reset for new generation.
   */
  const handleReset = () => {
    setContent(labManualContent || '');
    setProfileName('');
    setGeneratedProfile(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">生成Profile</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isLoading}
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

          {generatedProfile ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-2">
                  Profile生成成功！
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600">Profile名称</label>
                    <p className="text-sm font-medium">
                      {generatedProfile.profile_name || generatedProfile.topic_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">主题</label>
                    <p className="text-sm font-medium">
                      {generatedProfile.topic_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">目标受众</label>
                    <p className="text-sm font-medium">
                      {generatedProfile.target_audience}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Profile ID</label>
                    <p className="text-sm font-mono text-xs">
                      {generatedProfile.profile_id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
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
                  htmlFor="profile-name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Profile名称（可选）
                </label>
                <input
                  id="profile-name"
                  name="profile-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="留空则使用主题名称"
                />
                <p className="mt-1 text-xs text-gray-500">
                  如果不填写，将使用自动生成的主题名称
                </p>
              </div>

              <div>
                <label
                  htmlFor="lab-manual-content"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  实验文档内容 *
                </label>
                <textarea
                  id="lab-manual-content"
                  name="lab-manual-content"
                  rows={15}
                  value={content}
                  onChange={handleContentChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-50"
                  placeholder="请粘贴或输入实验文档内容..."
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  字符数：{content.length}
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
                  disabled={isLoading || !content.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '生成中...' : '生成Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

