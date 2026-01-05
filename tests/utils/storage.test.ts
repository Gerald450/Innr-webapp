import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedProfile,
  setCachedProfile,
  getCachedUniversityId,
  setCachedUniversityId,
  getCachedUserRole,
  setCachedUserRole,
  getCachedProfilePosts,
  setCachedProfilePosts,
  getCachedActivityPosts,
  setCachedActivityPosts,
  getCachedLoadedTabs,
  setCachedLoadedTabs,
  clearUserCache,
} from '@/utils/storage';

describe('Storage utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Profile cache', () => {
    it('should set and get cached profile', () => {
      const profile = { id: '123', full_name: 'Test User', role: 'admin' };
      setCachedProfile(profile);

      const cached = getCachedProfile();
      expect(cached).toEqual(profile);
    });

    it('should return null if profile is not cached', () => {
      const cached = getCachedProfile();
      expect(cached).toBeNull();
    });

    it('should return null if profile cache is expired', () => {
      const profile = { id: '123', full_name: 'Test User' };
      setCachedProfile(profile);

      // Mock time to be after TTL (10 minutes)
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => originalDateNow() + 11 * 60 * 1000);

      const cached = getCachedProfile();
      expect(cached).toBeNull();

      Date.now = originalDateNow;
    });
  });

  describe('University ID cache', () => {
    it('should set and get cached university ID', () => {
      const universityId = 'uni-123';
      setCachedUniversityId(universityId);

      const cached = getCachedUniversityId();
      expect(cached).toBe(universityId);
    });

    it('should return null if university ID is not cached', () => {
      const cached = getCachedUniversityId();
      expect(cached).toBeNull();
    });
  });

  describe('User Role cache', () => {
    it('should set and get cached user role', () => {
      const role = 'admin';
      setCachedUserRole(role);

      const cached = getCachedUserRole();
      expect(cached).toBe(role);
    });

    it('should return null if user role is not cached', () => {
      const cached = getCachedUserRole();
      expect(cached).toBeNull();
    });
  });

  describe('Profile Posts cache', () => {
    it('should set and get cached profile posts', () => {
      const userId = 'user-123';
      const posts = [{ id: 1, text: 'Post 1' }, { id: 2, text: 'Post 2' }];
      setCachedProfilePosts(userId, posts);

      const cached = getCachedProfilePosts(userId);
      expect(cached).toEqual(posts);
    });

    it('should return null if profile posts are not cached', () => {
      const cached = getCachedProfilePosts('user-123');
      expect(cached).toBeNull();
    });

    it('should handle different users separately', () => {
      const posts1 = [{ id: 1, text: 'Post 1' }];
      const posts2 = [{ id: 2, text: 'Post 2' }];

      setCachedProfilePosts('user-1', posts1);
      setCachedProfilePosts('user-2', posts2);

      expect(getCachedProfilePosts('user-1')).toEqual(posts1);
      expect(getCachedProfilePosts('user-2')).toEqual(posts2);
    });
  });

  describe('Activity Posts cache', () => {
    it('should set and get cached activity posts', () => {
      const userId = 'user-123';
      const activityType = 'liked';
      const posts = [{ id: 1, text: 'Post 1' }];
      setCachedActivityPosts(userId, activityType, posts);

      const cached = getCachedActivityPosts(userId, activityType);
      expect(cached).toEqual(posts);
    });

    it('should handle different activity types separately', () => {
      const userId = 'user-123';
      const likedPosts = [{ id: 1 }];
      const commentedPosts = [{ id: 2 }];

      setCachedActivityPosts(userId, 'liked', likedPosts);
      setCachedActivityPosts(userId, 'commented', commentedPosts);

      expect(getCachedActivityPosts(userId, 'liked')).toEqual(likedPosts);
      expect(getCachedActivityPosts(userId, 'commented')).toEqual(commentedPosts);
    });
  });

  describe('Loaded Tabs cache', () => {
    it('should set and get cached loaded tabs as Set', () => {
      const userId = 'user-123';
      const tabs = new Set(['tab1', 'tab2', 'tab3']);
      setCachedLoadedTabs(userId, tabs);

      const cached = getCachedLoadedTabs(userId);
      expect(cached).toBeInstanceOf(Set);
      expect(Array.from(cached!)).toEqual(['tab1', 'tab2', 'tab3']);
    });

    it('should return null if loaded tabs are not cached', () => {
      const cached = getCachedLoadedTabs('user-123');
      expect(cached).toBeNull();
    });
  });

  describe('clearUserCache', () => {
    it('should clear all user-related cache', () => {
      // Set various cache items
      setCachedProfile({ id: '123', full_name: 'Test' });
      setCachedUniversityId('uni-123');
      setCachedUserRole('admin');
      setCachedProfilePosts('user-123', [{ id: 1 }]);
      setCachedActivityPosts('user-123', 'liked', [{ id: 1 }]);
      setCachedLoadedTabs('user-123', new Set(['tab1']));

      clearUserCache('user-123');

      // Verify all cache is cleared
      expect(getCachedProfile()).toBeNull();
      expect(getCachedUniversityId()).toBeNull();
      expect(getCachedUserRole()).toBeNull();
      expect(getCachedProfilePosts('user-123')).toBeNull();
      expect(getCachedActivityPosts('user-123', 'liked')).toBeNull();
      expect(getCachedLoadedTabs('user-123')).toBeNull();
    });

    it('should clear general cache even without userId', () => {
      setCachedProfile({ id: '123', full_name: 'Test' });
      setCachedUniversityId('uni-123');
      setCachedUserRole('admin');

      clearUserCache();

      expect(getCachedProfile()).toBeNull();
      expect(getCachedUniversityId()).toBeNull();
      expect(getCachedUserRole()).toBeNull();
    });
  });

  describe('Storage availability handling', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw, should handle error gracefully
      expect(() => {
        setCachedProfile({ id: '123', full_name: 'Test' });
      }).not.toThrow();

      localStorage.setItem = originalSetItem;
    });

    it('should return null if localStorage is unavailable', () => {
      // Mock localStorage.getItem to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('SecurityError');
      });

      const cached = getCachedProfile();
      expect(cached).toBeNull();

      localStorage.getItem = originalGetItem;
    });
  });
});

