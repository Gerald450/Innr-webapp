/**
 * Browser storage utilities for caching user session data
 * Provides localStorage management with TTL support
 */

const CACHE_KEYS = {
  PROFILE: "innr_user_profile",
  UNIVERSITY_ID: "innr_university_id",
  USER_ROLE: "innr_user_role",
} as const;

const CACHE_TTL = {
  PROFILE: 10 * 60 * 1000, // 10 minutes
  UNIVERSITY_ID: 30 * 60 * 1000, // 30 minutes
  USER_ROLE: 30 * 60 * 1000, // 30 minutes
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

// Clear all user-related cache (useful for logout)
export function clearUserCache(): void {
  Object.values(CACHE_KEYS).forEach((key) => {
    removeCachedItem(key);
  });
}

