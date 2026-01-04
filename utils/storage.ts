/**
 * Browser storage utilities for caching user session data
 * Provides localStorage management with TTL support
 */

const CACHE_KEYS = {
  PROFILE: "innr_user_profile",
  UNIVERSITY_ID: "innr_university_id",
  USER_ROLE: "innr_user_role",
  PROFILE_POSTS_PREFIX: "innr_profile_posts_",
  ACTIVITY_POSTS_PREFIX: "innr_activity_posts_",
  LOADED_TABS_PREFIX: "innr_loaded_tabs_",
} as const;

const CACHE_TTL = {
  PROFILE: 10 * 60 * 1000, // 10 minutes
  UNIVERSITY_ID: 30 * 60 * 1000, // 30 minutes
  USER_ROLE: 30 * 60 * 1000, // 30 minutes
  PROFILE_POSTS: 5 * 60 * 1000, // 5 minutes
  ACTIVITY_POSTS: 5 * 60 * 1000, // 5 minutes
  LOADED_TABS: 5 * 60 * 1000, // 5 minutes
} as const;

type CachedItem<T> = {
  data: T;
  timestamp: number;
};

function isStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function getCachedItem<T>(key: string, ttl: number): T | null {
  if (!isStorageAvailable()) return null;

  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const cached: CachedItem<T> = JSON.parse(item);
    const now = Date.now();

    // Check if cache is expired
    if (now - cached.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return null;
  }
}

function setCachedItem<T>(key: string, data: T): void {
  if (!isStorageAvailable()) return;

  try {
    const cached: CachedItem<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error(`Error writing cache for ${key}:`, error);
  }
}

function removeCachedItem(key: string): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing cache for ${key}:`, error);
  }
}

// User Profile Cache
export function getCachedProfile(): any | null {
  return getCachedItem(CACHE_KEYS.PROFILE, CACHE_TTL.PROFILE);
}

export function setCachedProfile(profile: any): void {
  setCachedItem(CACHE_KEYS.PROFILE, profile);
}

// University ID Cache
export function getCachedUniversityId(): string | null {
  return getCachedItem(CACHE_KEYS.UNIVERSITY_ID, CACHE_TTL.UNIVERSITY_ID);
}

export function setCachedUniversityId(universityId: string): void {
  setCachedItem(CACHE_KEYS.UNIVERSITY_ID, universityId);
}

// User Role Cache
export function getCachedUserRole(): string | null {
  return getCachedItem(CACHE_KEYS.USER_ROLE, CACHE_TTL.USER_ROLE);
}

export function setCachedUserRole(role: string): void {
  setCachedItem(CACHE_KEYS.USER_ROLE, role);
}

// Profile Posts Cache (user-specific)
export function getCachedProfilePosts(userId: string): any[] | null {
  const key = `${CACHE_KEYS.PROFILE_POSTS_PREFIX}${userId}`;
  return getCachedItem<any[]>(key, CACHE_TTL.PROFILE_POSTS);
}

export function setCachedProfilePosts(userId: string, posts: any[]): void {
  const key = `${CACHE_KEYS.PROFILE_POSTS_PREFIX}${userId}`;
  setCachedItem(key, posts);
}

// Activity Posts Cache (user-specific, by type: liked/commented/reposted/saves)
export function getCachedActivityPosts(userId: string, activityType: string): any[] | null {
  const key = `${CACHE_KEYS.ACTIVITY_POSTS_PREFIX}${userId}_${activityType}`;
  return getCachedItem<any[]>(key, CACHE_TTL.ACTIVITY_POSTS);
}

export function setCachedActivityPosts(userId: string, activityType: string, posts: any[]): void {
  const key = `${CACHE_KEYS.ACTIVITY_POSTS_PREFIX}${userId}_${activityType}`;
  setCachedItem(key, posts);
}

// Loaded Tabs Cache (user-specific)
export function getCachedLoadedTabs(userId: string): Set<string> | null {
  const key = `${CACHE_KEYS.LOADED_TABS_PREFIX}${userId}`;
  const cached = getCachedItem<string[]>(key, CACHE_TTL.LOADED_TABS);
  return cached ? new Set(cached) : null;
}

export function setCachedLoadedTabs(userId: string, loadedTabs: Set<string>): void {
  const key = `${CACHE_KEYS.LOADED_TABS_PREFIX}${userId}`;
  setCachedItem(key, Array.from(loadedTabs));
}

// Clear all user-related cache (useful for logout)
export function clearUserCache(userId?: string): void {
  // Clear general cache keys
  Object.values(CACHE_KEYS).forEach((key) => {
    if (typeof key === 'string' && !key.includes('_PREFIX')) {
      removeCachedItem(key);
    }
  });
  
  // Clear user-specific profile cache if userId provided
  if (userId) {
    removeCachedItem(`${CACHE_KEYS.PROFILE_POSTS_PREFIX}${userId}`);
    removeCachedItem(`${CACHE_KEYS.LOADED_TABS_PREFIX}${userId}`);
    // Clear all activity types for this user
    ['liked', 'commented', 'reposted', 'saves'].forEach(activityType => {
      removeCachedItem(`${CACHE_KEYS.ACTIVITY_POSTS_PREFIX}${userId}_${activityType}`);
    });
  }
}

