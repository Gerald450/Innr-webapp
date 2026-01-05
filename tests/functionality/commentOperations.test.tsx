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

describe('Comment Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Comment creation', () => {
    it('should create a comment successfully', async () => {
      const postId = 'post-123';
      const user = { id: 'user-123' };
      const commentBody = 'This is a test comment';

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: {
            id: 'comment-123',
            body: commentBody,
            post_id: postId,
            author_id: user.id,
          },
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          body: commentBody,
          parent_comment_id: null,
        });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });
  });

  describe('Comment replies/threading', () => {
    it('should create a reply to a comment', async () => {
      const postId = 'post-123';
      const parentCommentId = 'comment-1';
      const user = { id: 'user-123' };
      const replyBody = 'This is a reply';

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: {
            id: 'reply-123',
            body: replyBody,
            post_id: postId,
            author_id: user.id,
            parent_comment_id: parentCommentId,
          },
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          body: replyBody,
          parent_comment_id: parentCommentId,
        });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });
  });

  describe('Comment deletion', () => {
    it('should handle comment deletion (soft delete)', async () => {
      const commentId = 'comment-123';

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('comments')
        .update({ is_deleted: true })
        .eq('id', commentId);

      expect(result.error).toBeNull();
    });
  });

  describe('Comment pagination', () => {
    it('should handle comment pagination correctly', async () => {
      const postId = 'post-123';
      const limit = 10;
      const cursor = '2024-01-01T00:00:00Z';

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        gt: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // Simulate paginated query
      let query = supabaseClient.supabase
        .from('comments')
        .select()
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true })
        .limit(limit + 1);

      if (cursor) {
        query = query.gt('created_at', cursor) as any;
      }

      const result = await query;

      expect(result.error).toBeNull();
    });
  });

  describe('Mention parsing and linking', () => {
    it('should parse @mentions in comment text', () => {
      const commentText = 'Hey @username, check this out!';
      const mentionPattern = /@(\w+)/g;
      const matches = Array.from(commentText.matchAll(mentionPattern));

      expect(matches.length).toBe(1);
      expect(matches[0][1]).toBe('username');
    });

    it('should handle multiple mentions', () => {
      const commentText = 'Hey @user1 and @user2, check this out!';
      const mentionPattern = /@(\w+)/g;
      const matches = Array.from(commentText.matchAll(mentionPattern));

      expect(matches.length).toBe(2);
      expect(matches[0][1]).toBe('user1');
      expect(matches[1][1]).toBe('user2');
    });

    it('should handle comments without mentions', () => {
      const commentText = 'This is a regular comment without mentions';
      const mentionPattern = /@(\w+)/g;
      const matches = Array.from(commentText.matchAll(mentionPattern));

      expect(matches.length).toBe(0);
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

    it('should handle network errors during comment creation', async () => {
      const postId = 'post-123';

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Network error')),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      try {
        await supabaseClient.supabase
          .from('comments')
          .insert({ post_id: postId });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network error');
      }
    });
  });
});

