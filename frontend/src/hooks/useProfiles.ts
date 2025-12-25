/**
 * Custom hook for managing tutor profiles.
 *
 * This hook provides state management and data fetching for profiles.
 */

import {useState, useEffect, useCallback} from 'react';
import {Profile} from '../types';
import {listProfiles as fetchProfiles} from '../api/profiles';

/**
 * Return type for useProfiles hook.
 */
export interface UseProfilesReturn {
  readonly profiles: readonly Profile[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing profiles.
 *
 * @returns Object containing profiles, loading state, error, and refresh function
 */
export function useProfiles(): UseProfilesReturn {
  const [profiles, setProfiles] = useState<readonly Profile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const profileList = await fetchProfiles();
      setProfiles(profileList);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load profiles';
      setError(errorMessage);
      console.error('Failed to load profiles:', err);
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  return {
    profiles,
    isLoading,
    error,
    refresh: loadProfiles,
  };
}


