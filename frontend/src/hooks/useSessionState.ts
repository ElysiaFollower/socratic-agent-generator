/**
 * Custom hook for managing session state and progress.
 *
 * This hook provides state management for session progress tracking.
 */

import {useState, useEffect, useCallback} from 'react';
import {SessionState, Profile, SocraticStep} from '../types';
import {getSessionState} from '../api/tutor';
import {extractCurriculumSteps} from '../utils/curriculum';

/**
 * Return type for useSessionState hook.
 */
export interface UseSessionStateReturn {
  readonly currentStep: number;
  readonly curriculum: readonly SocraticStep[];
  readonly currentProfile: Profile | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly setProfile: (profile: Profile | null) => void;
}

/**
 * Custom hook for managing session state and progress.
 *
 * @param sessionId - The current session ID (null if no session)
 * @returns Object containing step, curriculum, profile, and state functions
 */
export function useSessionState(
  sessionId: string | null,
): UseSessionStateReturn {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [curriculum, setCurriculum] = useState<readonly SocraticStep[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (!sessionId) {
      setCurrentStep(0);
      setCurriculum([]);
      setCurrentProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const stateResponse = await getSessionState(sessionId);
      setCurrentStep(stateResponse.stepIndex || 0);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load session state';
      setError(errorMessage);
      console.error('Failed to load session state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const setProfileCallback = useCallback((profile: Profile | null) => {
    setCurrentProfile(profile);
    if (profile) {
      const curriculumSteps = extractCurriculumSteps(profile.curriculum);
      setCurriculum(curriculumSteps);
    } else {
      setCurriculum([]);
    }
  }, []);

  return {
    currentStep,
    curriculum,
    currentProfile,
    isLoading,
    error,
    refresh: loadState,
    setProfile: setProfileCallback,
  };
}




