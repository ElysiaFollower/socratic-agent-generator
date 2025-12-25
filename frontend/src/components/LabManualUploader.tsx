/**
 * Lab manual uploader component.
 *
 * This component provides a UI for uploading, viewing, and deleting lab manual files,
 * following Google TypeScript Style Guide.
 */

import React, {useState, ChangeEvent, FormEvent, useEffect, useCallback} from 'react';
import {
  uploadLabManual,
  listLabManuals,
  getLabManualContent,
  deleteLabManual,
  type UploadLabManualRequest,
  type UploadLabManualResponse,
  type LabManualInfo,
  type LabManualContent,
} from '../api';

/**
 * Props for LabManualUploader component.
 */
interface LabManualUploaderProps {
  readonly onUploadSuccess?: (response: UploadLabManualResponse) => void;
  readonly onClose?: () => void;
}

type Tab = 'upload' | 'manage';

/**
 * Lab manual uploader component.
 *
 * @param props - Component props
 * @returns React component
 */
export function LabManualUploader(
  props: LabManualUploaderProps,
): JSX.Element {
  const {onUploadSuccess, onClose} = props;
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  
  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [labName, setLabName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] =
    useState<UploadLabManualResponse | null>(null);

  // Manage tab state
  const [labManuals, setLabManuals] = useState<readonly LabManualInfo[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState<boolean>(false);
  const [viewingContent, setViewingContent] = useState<LabManualContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [deletingLab, setDeletingLab] = useState<string | null>(null);

  /**
   * Loads lab manuals list.
   */
  const loadLabManuals = useCallback(async () => {
    setIsLoadingManuals(true);
    setError(null);
    try {
      const manuals = await listLabManuals();
      setLabManuals(manuals);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '加载实验文档列表失败';
      setError(errorMessage);
      console.error('Failed to load lab manuals:', err);
    } finally {
      setIsLoadingManuals(false);
    }
  }, []);

  /**
   * Loads lab manuals when manage tab is active.
   */
  useEffect(() => {
    if (activeTab === 'manage') {
      void loadLabManuals();
    }
  }, [activeTab, loadLabManuals]);

  /**
   * Handles file selection.
   *
   * @param event - File input change event
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      // Validate file type
      const allowedExtensions = ['.md', '.txt', '.markdown'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      if (fileExtension && !allowedExtensions.includes(`.${fileExtension}`)) {
        setError(
          `不支持的文件类型。支持的类型：${allowedExtensions.join(', ')}`,
        );
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
      setUploadResponse(null);
    }
  };

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('请选择一个文件');
      return;
    }
    if (!labName.trim()) {
      setError('请输入实验名称');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const request: UploadLabManualRequest = {
        file: selectedFile,
        lab_name: labName.trim(),
      };
      const response = await uploadLabManual(request);
      setUploadResponse(response);
      if (onUploadSuccess) {
        onUploadSuccess(response);
      }
      // Refresh lab manuals list if on manage tab
      if (activeTab === 'manage') {
        await loadLabManuals();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '上传失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles reset for new upload.
   */
  const handleReset = () => {
    setSelectedFile(null);
    setLabName('');
    setUploadResponse(null);
    setError(null);
    // Reset file input
    const fileInput = document.getElementById(
      'lab-manual-file',
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  /**
   * Handles viewing lab manual content.
   */
  const handleViewContent = async (labName: string) => {
    setIsLoadingContent(true);
    setError(null);
    try {
      const content = await getLabManualContent(labName);
      setViewingContent(content);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '加载文档内容失败';
      setError(errorMessage);
    } finally {
      setIsLoadingContent(false);
    }
  };

  /**
   * Handles deleting a lab manual.
   */
  const handleDelete = async (labName: string) => {
    if (!confirm(`确定要删除实验文档 "${labName}" 吗？此操作将删除整个实验目录及其所有内容，无法撤销。`)) {
      return;
    }

    setDeletingLab(labName);
    setError(null);
    try {
      await deleteLabManual(labName);
      await loadLabManuals();
      if (viewingContent && viewingContent.lab_name === labName) {
        setViewingContent(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '删除失败';
      setError(errorMessage);
    } finally {
      setDeletingLab(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">实验文档管理</h2>
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

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab('upload');
                setError(null);
                setViewingContent(null);
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'upload'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              上传文档
            </button>
            <button
              onClick={() => {
                setActiveTab('manage');
                setError(null);
                setViewingContent(null);
              }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'manage'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              管理文档
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
              role="alert"
            >
              {error}
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              {uploadResponse ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      上传成功！
                    </p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">实验名称</label>
                        <p className="text-sm font-medium">
                          {uploadResponse.lab_name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">文件大小</label>
                        <p className="text-sm font-medium">
                          {(uploadResponse.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      上传新文件
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
                      htmlFor="lab-name"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      实验名称 *
                    </label>
                    <input
                      id="lab-name"
                      name="lab-name"
                      type="text"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      placeholder="例如：SQL-injection"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      将创建 data_raw/{'{实验名称}'}/lab_manual.md
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="lab-manual-file"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      选择文件 *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="lab-manual-file"
                        name="lab-manual-file"
                        type="file"
                        accept=".md,.txt,.markdown"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        required
                      />
                    </div>
                    {selectedFile && (
                      <p className="mt-2 text-sm text-gray-600">
                        已选择：{selectedFile.name} (
                        {(selectedFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      支持的文件类型：.md, .txt, .markdown
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
                      disabled={isLoading || !selectedFile || !labName.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '上传中...' : '上传'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-4">
              {isLoadingManuals ? (
                <div className="text-center py-8 text-gray-500">
                  加载中...
                </div>
              ) : labManuals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无实验文档
                </div>
              ) : (
                <div className="space-y-2">
                  {labManuals.map((lab) => (
                    <div
                      key={lab.lab_name}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-2">
                            {lab.lab_name}
                          </h3>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span
                              className={
                                lab.has_lab_manual ? 'text-green-600' : 'text-gray-400'
                              }
                            >
                              文档 {lab.has_lab_manual ? '✓' : '✗'}
                            </span>
                            <span
                              className={lab.has_persona ? 'text-green-600' : 'text-gray-400'}
                            >
                              Persona {lab.has_persona ? '✓' : '✗'}
                            </span>
                            <span
                              className={
                                lab.has_curriculum ? 'text-green-600' : 'text-gray-400'
                              }
                            >
                              Curriculum {lab.has_curriculum ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {lab.has_lab_manual && (
                            <button
                              onClick={() => handleViewContent(lab.lab_name)}
                              disabled={isLoadingContent}
                              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              {isLoadingContent ? '加载中...' : '查看'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(lab.lab_name)}
                            disabled={deletingLab === lab.lab_name}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {deletingLab === lab.lab_name ? '删除中...' : '删除'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewingContent && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {viewingContent.lab_name} - 文档内容
                    </h3>
                    <button
                      onClick={() => setViewingContent(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-gray-800">
                      {viewingContent.content}
                    </pre>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    文件大小: {(viewingContent.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
