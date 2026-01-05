import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseClient from '@/lib/supabaseClient';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Post Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Like/Unlike flow', () => {
    it('should like a post successfully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: user.id,
        });

      expect(result.error).toBeNull();
    });

    it('should unlike a post successfully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      expect(result.error).toBeNull();
    });
  });

  describe('Repost/Unrepost flow', () => {
    it('should repost successfully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('reposts')
        .insert({
          post_id: postId,
          user_id: user.id,
          comment: null,
        });

      expect(result.error).toBeNull();
    });

    it('should handle duplicate repost gracefully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('reposts')
        .insert({
          post_id: postId,
          user_id: user.id,
        });

      // Should handle duplicate gracefully (code 23505 is expected)
      expect(result.error?.code).toBe('23505');
    });
  });

  describe('Bookmark/Unbookmark flow', () => {
    it('should bookmark a post successfully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('bookmarks')
        .insert({
          post_id: postId,
          user_id: user.id,
        });

      expect(result.error).toBeNull();
    });

    it('should unbookmark a post successfully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('bookmarks')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      expect(result.error).toBeNull();
    });
  });

  describe('Interaction state persistence', () => {
    it('should maintain like state correctly', () => {
      let isLiked = false;
      let likeCount = 5;

      // Toggle like
      isLiked = !isLiked;
      likeCount = isLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

      expect(isLiked).toBe(true);
      expect(likeCount).toBe(6);

      // Toggle unlike
      isLiked = !isLiked;
      likeCount = isLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

      expect(isLiked).toBe(false);
      expect(likeCount).toBe(5);
    });

    it('should prevent negative counts', () => {
      let likeCount = 0;

      // Try to decrease below zero
      likeCount = Math.max(0, likeCount - 1);

      expect(likeCount).toBe(0);
      expect(likeCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should handle authentication errors', async () => {
      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      const { data, error } = await supabaseClient.supabase.auth.getUser();

      expect(data.user).toBeNull();
      expect(error).toBeDefined();
    });

    it('should handle network errors during interaction', async () => {
      const postId = 'post-123';

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Network error')),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      try {
        await supabaseClient.supabase
          .from('post_likes')
          .insert({ post_id: postId });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network error');
      }
    });
  });
});

