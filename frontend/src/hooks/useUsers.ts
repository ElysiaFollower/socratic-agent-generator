/**
 * Custom hook for managing user information cache.
 *
 * This hook provides caching and fetching for user display information.
 */

import { useState, useCallback } from "react";
import { User } from "../types";
import { getUserById } from "../api";

/**
 * User info cache interface.
 */
interface UserInfo {
  readonly display_name: string | undefined;
  readonly username: string;
  readonly user_id: string;
}

/**
 * Custom hook for fetching and caching user information.
 *
 * @returns Object containing getUserDisplayName function
 */
export function useUsers() {
  const [userCache, setUserCache] = useState<Map<string, UserInfo>>(new Map());

  /**
   * Fetch user info by user_id with caching.
   *
   * @param userId - The user ID to look up
   * @returns Promise resolving to display name (or username or ID as fallback)
   */
  const getUserDisplayName = useCallback(async (userId: string): Promise<string> => {
    // Check cache first
    const cached = userCache.get(userId);
    if (cached) {
      return cached.display_name || cached.username || cached.user_id;
    }

    // Fetch from API
    try {
      const user: User = await getUserById(userId);
      const userInfo: UserInfo = {
        display_name: user.display_name,
        username: user.username,
        user_id: user.user_id,
      };

      // Update cache
      setUserCache((prev) => new Map(prev).set(userId, userInfo));

      return user.display_name || user.username || user.user_id;
    } catch (err) {
      console.error(`Failed to fetch user ${userId}:`, err);
      return userId; // Fallback to user_id
    }
  }, [userCache]);

  return { getUserDisplayName };
}
