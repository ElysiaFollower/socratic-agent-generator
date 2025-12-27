/**
 * Custom hook for managing learning sessions.
 *
 * This hook provides state management and data fetching for sessions.
 */

import {useState, useEffect, useCallback} from 'react';
import {SessionSummary} from '../types';
import {listSessions as fetchSessions} from '../api/sessions';

/**
 * Return type for useSessions hook.
 */
export interface UseSessionsReturn {
  readonly sessions: readonly SessionSummary[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing sessions.
 *
 * @returns Object containing sessions, loading state, error, and refresh function
 */
export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<readonly SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionList = await fetchSessions();
      setSessions(sessionList);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      console.error('Failed to load sessions:', err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    isLoading,
    error,
    refresh: loadSessions,
  };
}




