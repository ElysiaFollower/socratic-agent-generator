/**
 * Advanced profile generator component.
 *
 * This component provides a UI for generating tutor profiles from lab manuals,
 * following the workflow in main.py: select lab -> generate/edit persona &
 * curriculum -> generate profile.
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  listLabManuals,
  getPersona,
  savePersona,
  getCurriculum,
  saveCurriculum,
  generatePersona,
  generateCurriculum,
  generateProfileFromLab,
  type LabManualInfo,
  type TutorPersona,
  type SocraticCurriculum,
} from '../api';
import {Profile} from '../types';

/**
 * Props for ProfileGeneratorAdvanced component.
 */
interface ProfileGeneratorAdvancedProps {
  readonly onGenerateSuccess?: (profile: Profile) => void;
  readonly onClose?: () => void;
}

type Step = 'select' | 'generate' | 'finalize';

/**
 * Advanced profile generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileGeneratorAdvanced(
  props: ProfileGeneratorAdvancedProps,
): JSX.Element {
  const {onGenerateSuccess, onClose} = props;
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [labManuals, setLabManuals] = useState<readonly LabManualInfo[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState<boolean>(true);
  const [selectedLab, setSelectedLab] = useState<string | null>(null);
  const [persona, setPersona] = useState<TutorPersona | null>(null);
  const [curriculum, setCurriculum] = useState<SocraticCurriculum | null>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [personaStatus, setPersonaStatus] = useState<
    'idle' | 'generating' | 'generated' | 'error'
  >('idle');
  const [curriculumStatus, setCurriculumStatus] = useState<
    'idle' | 'generating' | 'generated' | 'error'
  >('idle');
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState<boolean>(false);

  /**
   * Loads lab manuals list.
   */
  const loadLabManuals = useCallback(async () => {
    setIsLoadingManuals(true);
    setError(null);
    try {
      const manuals = await listLabManuals();
      setLabManuals(manuals);
      console.log(`[ProfileGeneratorAdvanced] Loaded ${manuals.length} lab manuals`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '加载实验文档列表失败';
      setError(errorMessage);
      console.error('Failed to load lab manuals:', err);
    } finally {
      setIsLoadingManuals(false);
    }
  }, []);

  useEffect(() => {
    void loadLabManuals();
  }, [loadLabManuals]);

  /**
   * Handles lab selection.
   */
  const handleSelectLab = async (labName: string) => {
    setSelectedLab(labName);
    setError(null);
    setPersonaStatus('idle');
    setCurriculumStatus('idle');
    setPersonaError(null);
    setCurriculumError(null);
    setPersona(null);
    setCurriculum(null);

    // Try to load existing persona and curriculum
    const labInfo = labManuals.find((m) => m.lab_name === labName);
    if (labInfo) {
      try {
        if (labInfo.has_persona) {
          const loadedPersona = await getPersona(labName);
          if (loadedPersona) {
            setPersona(loadedPersona);
            setPersonaStatus('generated');
          }
        }
        if (labInfo.has_curriculum) {
          try {
            const loadedCurriculum = await getCurriculum(labName);
            console.log('Loaded curriculum:', loadedCurriculum);
            const normalized = normalizeCurriculum(loadedCurriculum);
            if (normalized) {
              setCurriculum(normalized);
              setCurriculumStatus('generated');
            } else {
              console.warn('Loaded curriculum has invalid structure:', loadedCurriculum);
              setCurriculumError('Curriculum数据格式不正确');
              setCurriculumStatus('error');
            }
          } catch (curriculumErr) {
            console.warn('Failed to load curriculum:', curriculumErr);
            setCurriculumError('加载Curriculum失败');
            setCurriculumStatus('error');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '加载失败';
        console.warn('Failed to load existing persona/curriculum:', err);
        setError(`加载数据失败: ${errorMessage}`);
      }
    }

    setCurrentStep('generate');
  };

  /**
   * Handles persona generation.
   */
  const handleGeneratePersona = async () => {
    if (!selectedLab) {
      return;
    }

    setPersonaStatus('generating');
    setPersonaError(null);
    setError(null);

    try {
      const generated = await generatePersona(selectedLab);
      setPersona(generated);
      setPersonaStatus('generated');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成Persona失败';
      setPersonaError(errorMessage);
      setPersonaStatus('error');
    }
  };

  /**
   * Handles persona save.
   */
  const handleSavePersona = async () => {
    if (!selectedLab || !persona) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await savePersona(selectedLab, persona);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '保存Persona失败';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Normalizes curriculum data format.
   * Handles both {root: [...]} and direct array formats.
   */
  const normalizeCurriculum = (data: any): SocraticCurriculum | null => {
    if (!data) {
      return null;
    }
    if (data.root && Array.isArray(data.root)) {
      return data as SocraticCurriculum;
    }
    if (Array.isArray(data)) {
      return {root: data as any};
    }
    console.warn('Invalid curriculum format:', data);
    return null;
  };

  /**
   * Handles curriculum generation.
   */
  const handleGenerateCurriculum = async () => {
    if (!selectedLab) {
      return;
    }

    setCurriculumStatus('generating');
    setCurriculumError(null);
    setError(null);

    try {
      const generated = await generateCurriculum(selectedLab);
      const normalized = normalizeCurriculum(generated);
      if (normalized) {
        setCurriculum(normalized);
        setCurriculumStatus('generated');
      } else {
        setCurriculumError('生成的Curriculum格式不正确');
        setCurriculumStatus('error');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成Curriculum失败';
      setCurriculumError(errorMessage);
      setCurriculumStatus('error');
    }
  };

  /**
   * Handles curriculum save.
   */
  const handleSaveCurriculum = async () => {
    if (!selectedLab || !curriculum) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await saveCurriculum(selectedLab, curriculum);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '保存Curriculum失败';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles both persona and curriculum generation in parallel.
   */
  const handleGenerateBoth = async () => {
    if (!selectedLab) {
      return;
    }

    setPersonaStatus('generating');
    setCurriculumStatus('generating');
    setPersonaError(null);
    setCurriculumError(null);
    setError(null);

    try {
      // Generate both in parallel
      const [generatedPersona, generatedCurriculum] = await Promise.all([
        generatePersona(selectedLab),
        generateCurriculum(selectedLab),
      ]);

      setPersona(generatedPersona);
      setPersonaStatus('generated');
      setCurriculum(generatedCurriculum);
      setCurriculumStatus('generated');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成失败';
      setError(errorMessage);
      // Try to determine which one failed
      if (!persona) {
        setPersonaStatus('error');
        setPersonaError(errorMessage);
      }
      if (!curriculum) {
        setCurriculumStatus('error');
        setCurriculumError(errorMessage);
      }
    }
  };

  /**
   * Handles moving to finalize step - save and reload data like main.py.
   */
  const handleFinalize = async () => {
    if (!selectedLab || !persona || !curriculum) {
      setError('请先生成Persona和Curriculum');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save persona and curriculum first
      await Promise.all([
        savePersona(selectedLab, persona),
        saveCurriculum(selectedLab, curriculum),
      ]);

      // Reload from files (like main.py does)
      const [reloadedPersona, reloadedCurriculum] = await Promise.all([
        getPersona(selectedLab),
        getCurriculum(selectedLab),
      ]);

      setPersona(reloadedPersona);
      setCurriculum(reloadedCurriculum);
      setCurrentStep('finalize');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '保存或加载失败';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles profile generation.
   */
  const handleGenerateProfile = async () => {
    if (!selectedLab || !persona || !curriculum) {
      setError('请先生成Persona和Curriculum');
      return;
    }

    setIsGeneratingProfile(true);
    setError(null);

    try {
      const profile = await generateProfileFromLab(
        selectedLab,
        profileName.trim() || undefined,
      );
      if (onGenerateSuccess) {
        onGenerateSuccess(profile);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成Profile失败';
      setError(errorMessage);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">生成Profile</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={
                  isLoading ||
                  personaStatus === 'generating' ||
                  curriculumStatus === 'generating' ||
                  isGeneratingProfile
                }
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

          {/* Step indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div
                className={`flex items-center ${
                  currentStep === 'select' ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === 'select'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  1
                </div>
                <span className="ml-2 text-sm font-medium">选择实验文档</span>
              </div>
              <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
              <div
                className={`flex items-center ${
                  currentStep === 'generate' ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === 'generate'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  2
                </div>
                <span className="ml-2 text-sm font-medium">
                  生成Persona和Curriculum
                </span>
              </div>
              <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
              <div
                className={`flex items-center ${
                  currentStep === 'finalize' ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === 'finalize'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  3
                </div>
                <span className="ml-2 text-sm font-medium">生成Profile</span>
              </div>
            </div>
          </div>

          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Step 1: Select Lab */}
          {currentStep === 'select' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">选择实验文档</h3>
              {isLoadingManuals ? (
                <p className="text-gray-500">加载中...</p>
              ) : labManuals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">暂无实验文档</p>
                  <p className="text-sm text-gray-400">
                    请先使用"上传实验文档"功能上传文档
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {labManuals.map((lab) => (
                    <button
                      key={lab.lab_name}
                      onClick={() => handleSelectLab(lab.lab_name)}
                      className="w-full p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {lab.lab_name}
                          </p>
                          <div className="flex gap-4 mt-1 text-sm text-gray-500">
                            <span
                              className={
                                lab.has_lab_manual ? 'text-green-600' : ''
                              }
                            >
                              文档 {lab.has_lab_manual ? '✓' : '✗'}
                            </span>
                            <span
                              className={lab.has_persona ? 'text-green-600' : ''}
                            >
                              Persona {lab.has_persona ? '✓' : '✗'}
                            </span>
                            <span
                              className={
                                lab.has_curriculum ? 'text-green-600' : ''
                              }
                            >
                              Curriculum {lab.has_curriculum ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Generate Persona and Curriculum */}
          {currentStep === 'generate' && selectedLab && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  生成Persona和Curriculum - {selectedLab}
                </h3>
                <button
                  onClick={() => {
                    setCurrentStep('select');
                    setPersona(null);
                    setCurriculum(null);
                    setPersonaStatus('idle');
                    setCurriculumStatus('idle');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  返回
                </button>
              </div>

              {/* Generation controls */}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateBoth}
                  disabled={
                    personaStatus === 'generating' ||
                    curriculumStatus === 'generating'
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {personaStatus === 'generating' ||
                  curriculumStatus === 'generating'
                    ? '生成中...'
                    : '同时生成Persona和Curriculum'}
                </button>
                <button
                  onClick={handleGeneratePersona}
                  disabled={personaStatus === 'generating'}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {personaStatus === 'generating'
                    ? '生成Persona中...'
                    : '仅生成Persona'}
                </button>
                <button
                  onClick={handleGenerateCurriculum}
                  disabled={curriculumStatus === 'generating'}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {curriculumStatus === 'generating'
                    ? '生成Curriculum中...'
                    : '仅生成Curriculum'}
                </button>
              </div>

              {/* Two-column layout for Persona and Curriculum */}
              <div className="grid grid-cols-2 gap-4">
                {/* Persona Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Persona</h4>
                    <div className="flex items-center gap-2">
                      {personaStatus === 'generating' && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {personaStatus === 'generated' && (
                        <span className="text-green-600 text-sm">✓</span>
                      )}
                      {personaStatus === 'error' && (
                        <span className="text-red-600 text-sm">✗</span>
                      )}
                    </div>
                  </div>

                  {personaError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {personaError}
                    </div>
                  )}

                  {persona ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700">
                          主题名称
                        </label>
                        <input
                          type="text"
                          value={persona.topic_name}
                          onChange={(e) =>
                            setPersona({...persona, topic_name: e.target.value})
                          }
                          className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">
                          目标受众
                        </label>
                        <input
                          type="text"
                          value={persona.target_audience}
                          onChange={(e) =>
                            setPersona({
                              ...persona,
                              target_audience: e.target.value,
                            })
                          }
                          className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">
                          人设提示（每行一个）
                        </label>
                        <textarea
                          value={persona.persona_hints.join('\n')}
                          onChange={(e) =>
                            setPersona({
                              ...persona,
                              persona_hints: e.target.value
                                .split('\n')
                                .filter((h) => h.trim()),
                            })
                          }
                          rows={3}
                          className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">
                          领域约束（每行一个）
                        </label>
                        <textarea
                          value={persona.domain_specific_constraints.join('\n')}
                          onChange={(e) =>
                            setPersona({
                              ...persona,
                              domain_specific_constraints: e.target.value
                                .split('\n')
                                .filter((c) => c.trim()),
                            })
                          }
                          rows={3}
                          className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <button
                        onClick={handleSavePersona}
                        disabled={isLoading}
                        className="w-full px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {isLoading ? '保存中...' : '保存Persona'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {personaStatus === 'generating'
                        ? '正在生成...'
                        : 'Persona未生成'}
                    </p>
                  )}
                </div>

                {/* Curriculum Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Curriculum</h4>
                    <div className="flex items-center gap-2">
                      {curriculumStatus === 'generating' && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {curriculumStatus === 'generated' && (
                        <span className="text-green-600 text-sm">✓</span>
                      )}
                      {curriculumStatus === 'error' && (
                        <span className="text-red-600 text-sm">✗</span>
                      )}
                    </div>
                  </div>

                  {curriculumError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {curriculumError}
                    </div>
                  )}

                  {curriculum && curriculum.root ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      <div className="text-xs text-gray-600 mb-2">
                        共 {curriculum.root.length} 个步骤
                      </div>
                      {curriculum.root.map((step, index) => (
                        <div
                          key={index}
                          className="border-b border-gray-200 pb-2 last:border-0"
                        >
                          <div className="font-medium text-xs text-gray-900 mb-1">
                            步骤 {index + 1}: {step.step_title}
                          </div>
                          <div className="space-y-1 text-xs">
                            <div>
                              <label className="text-gray-600">引导问题</label>
                              <textarea
                                value={step.guiding_question}
                                onChange={(e) => {
                                  const newRoot = [...curriculum.root];
                                  newRoot[index] = {
                                    ...step,
                                    guiding_question: e.target.value,
                                  };
                                  setCurriculum({root: newRoot});
                                }}
                                rows={2}
                                className="w-full mt-0.5 px-1.5 py-1 border border-gray-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-gray-600">成功标准</label>
                              <textarea
                                value={step.success_criteria}
                                onChange={(e) => {
                                  const newRoot = [...curriculum.root];
                                  newRoot[index] = {
                                    ...step,
                                    success_criteria: e.target.value,
                                  };
                                  setCurriculum({root: newRoot});
                                }}
                                rows={2}
                                className="w-full mt-0.5 px-1.5 py-1 border border-gray-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-gray-600">学习目标</label>
                              <textarea
                                value={step.learning_objective}
                                onChange={(e) => {
                                  const newRoot = [...curriculum.root];
                                  newRoot[index] = {
                                    ...step,
                                    learning_objective: e.target.value,
                                  };
                                  setCurriculum({root: newRoot});
                                }}
                                rows={2}
                                className="w-full mt-0.5 px-1.5 py-1 border border-gray-300 rounded text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleSaveCurriculum}
                        disabled={isLoading}
                        className="w-full px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {isLoading ? '保存中...' : '保存Curriculum'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {curriculumStatus === 'generating'
                        ? '正在生成...'
                        : 'Curriculum未生成'}
                    </p>
                  )}
                </div>
              </div>

              {/* Next step button */}
              {persona && curriculum && (
                <div className="flex justify-end">
                  <button
                    onClick={handleFinalize}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? '保存并加载中...' : '下一步：生成Profile'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Generate Profile */}
          {currentStep === 'finalize' && selectedLab && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  生成Profile - {selectedLab}
                </h3>
                <button
                  onClick={() => setCurrentStep('generate')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  返回
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile名称（可选）
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="留空则自动生成"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">预览信息</h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-600">实验文档：</span>
                      {selectedLab}
                    </p>
                    {persona && (
                      <>
                        <p>
                          <span className="text-gray-600">主题：</span>
                          {persona.topic_name}
                        </p>
                        <p>
                          <span className="text-gray-600">目标受众：</span>
                          {persona.target_audience}
                        </p>
                      </>
                    )}
                    {curriculum && curriculum.root && (
                      <p>
                        <span className="text-gray-600">步骤数：</span>
                        {curriculum.root.length}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateProfile}
                  disabled={isGeneratingProfile || !persona || !curriculum}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isGeneratingProfile ? '生成中...' : '生成Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add logger for debugging
const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`[ProfileGeneratorAdvanced] ${message}`, ...args);
  },
};
