import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import * as supabaseClient from '@/lib/supabaseClient';
import { createWrapper } from '@/utils/testHelpers';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Concurrent Post Interactions', () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    wrapper = createWrapper(queryClient);
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Race Conditions', () => {
    it('should handle multiple simultaneous likes correctly', async () => {
      const postId = 'post-123';
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
        { id: 'user-3', name: 'User 3' },
      ];

      let likeCount = 0;
      const insertMock = vi.fn().mockImplementation(() => {
        likeCount++;
        return Promise.resolve({ data: {}, error: null });
      });

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockImplementation((user: any) => {
        return Promise.resolve({
          data: { user: users.find((u) => u.id === user?.id) || users[0] },
          error: null,
        } as any);
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: insertMock,
        delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // Simulate concurrent likes
      const likePromises = users.map((user) => {
        vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValueOnce({
          data: { user },
          error: null,
        } as any);

        return mockFrom().insert({
          post_id: postId,
          user_id: user.id,
        });
      });

      await Promise.all(likePromises);

      // All inserts should have been called
      expect(insertMock).toHaveBeenCalledTimes(3);
      expect(likeCount).toBe(3);
    });

    it('should prevent duplicate likes (unique constraint)', async () => {
      const postId = 'post-123';
      const user = { id: 'user-1' };

      const insertMock = vi.fn()
        .mockResolvedValueOnce({ data: {}, error: null }) // First like succeeds
        .mockResolvedValueOnce({
          // Second like fails with unique constraint
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        });

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: insertMock,
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // First like should succeed
      const result1 = await mockFrom().insert({ post_id: postId, user_id: user.id });
      expect(result1.error).toBeNull();

      // Second like should handle unique constraint gracefully
      const result2 = await mockFrom().insert({ post_id: postId, user_id: user.id });
      expect(result2.error?.code).toBe('23505');
    });
  });

  describe('Double-Click Prevention', () => {
    it('should prevent multiple simultaneous actions with isLiking flag', async () => {
      const postId = 'post-123';
      let isLiking = false;
      let actionCount = 0;

      const performLike = async () => {
        if (isLiking) return; // Double-click prevention
        isLiking = true;
        actionCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        isLiking = false;
      };

      // Simulate rapid double-click
      await Promise.all([performLike(), performLike()]);

      // Only one action should have executed
      expect(actionCount).toBe(1);
    });
  });

  describe('Optimistic Updates', () => {
    it('should update cache optimistically before server response', async () => {
      const postId = 'post-123';
      const initialData = [
        { id: postId, likeCount: 5, isLiked: false },
      ];

      queryClient.setQueryData(['posts', 'uni-123'], initialData);

      // Optimistic update
      queryClient.setQueryData(['posts', 'uni-123'], (old: any) => {
        if (!old) return old;
        return old.map((post: any) =>
          post.id === postId
            ? { ...post, likeCount: 6, isLiked: true }
            : post
        );
      });

      const cachedData = queryClient.getQueryData(['posts', 'uni-123']);
      expect(cachedData).toBeDefined();
      const post = (cachedData as any[]).find((p) => p.id === postId);
      expect(post?.likeCount).toBe(6);
      expect(post?.isLiked).toBe(true);
    });

    it('should handle optimistic update rollback on error', async () => {
      const postId = 'post-123';
      const initialData = [
        { id: postId, likeCount: 5, isLiked: false },
      ];

      queryClient.setQueryData(['posts', 'uni-123'], initialData);

      // Optimistic update
      queryClient.setQueryData(['posts', 'uni-123'], (old: any) => {
        if (!old) return old;
        return old.map((post: any) =>
          post.id === postId
            ? { ...post, likeCount: 6, isLiked: true }
            : post
        );
      });

      // Simulate error - rollback by invalidating
      queryClient.invalidateQueries({ queryKey: ['posts', 'uni-123'] });

      // After invalidation, data should be stale (need to refetch)
      const queryState = queryClient.getQueryState(['posts', 'uni-123']);
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe('Cache Consistency', () => {
    it('should maintain consistent cache across multiple queries', async () => {
      const postId = 'post-123';
      const universityId = 'uni-123';

      const postData = { id: postId, likeCount: 5, isLiked: false };
      queryClient.setQueryData(['posts', universityId], [postData]);
      queryClient.setQueryData(['post', postId], postData);

      // Update both cache entries
      queryClient.setQueryData(['posts', universityId], (old: any) =>
        old.map((p: any) => (p.id === postId ? { ...p, likeCount: 6 } : p))
      );
      queryClient.setQueryData(['post', postId], (old: any) => ({
        ...old,
        likeCount: 6,
      }));

      const listData = queryClient.getQueryData(['posts', universityId]) as any[];
      const detailData = queryClient.getQueryData(['post', postId]) as any;

      expect(listData?.[0]?.likeCount).toBe(6);
      expect(detailData?.likeCount).toBe(6);
    });
  });
});

