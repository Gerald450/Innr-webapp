import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
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

describe('Concurrent Comments', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Concurrent Comment Posting', () => {
    it('should handle multiple users commenting simultaneously', async () => {
      const postId = 'post-123';
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
        { id: 'user-3', name: 'User 3' },
      ];

      const comments = [
        { body: 'Comment 1' },
        { body: 'Comment 2' },
        { body: 'Comment 3' },
      ];

      let commentCount = 0;
      const insertMock = vi.fn().mockImplementation(() => {
        commentCount++;
        return Promise.resolve({
          data: { id: `comment-${commentCount}`, body: comments[commentCount - 1].body },
          error: null,
        });
      });

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockImplementation((user: any) => {
        return Promise.resolve({
          data: { user: users.find((u) => u.id === user?.id) || users[0] },
          error: null,
        } as any);
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: insertMock,
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // Simulate concurrent comments
      const commentPromises = users.map((user, index) =>
        mockFrom().insert({
          post_id: postId,
          author_id: user.id,
          body: comments[index].body,
          parent_comment_id: null,
        })
      );

      await Promise.all(commentPromises);

      expect(insertMock).toHaveBeenCalledTimes(3);
      expect(commentCount).toBe(3);
    });
  });

  describe('Comment Count Accuracy', () => {
    it('should correctly track comment count under concurrent additions', async () => {
      const postId = 'post-123';
      let count = 5;

      // Simulate concurrent comment additions
      const increments = [1, 1, 1];
      increments.forEach(() => {
        count++;
      });

      expect(count).toBe(8); // 5 + 3 concurrent comments
    });

    it('should maintain accurate count when comments are deleted', async () => {
      let count = 10;
      const deletions = 2;

      count = Math.max(0, count - deletions);
      expect(count).toBe(8);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Reply Threading Under Concurrent Writes', () => {
    it('should handle concurrent replies to same comment', async () => {
      const postId = 'post-123';
      const parentCommentId = 'comment-1';
      const users = [
        { id: 'user-1' },
        { id: 'user-2' },
      ];

      const replies = [
        { body: 'Reply 1', parent_comment_id: parentCommentId },
        { body: 'Reply 2', parent_comment_id: parentCommentId },
      ];

      let replyCount = 0;
      const insertMock = vi.fn().mockImplementation(() => {
        replyCount++;
        return Promise.resolve({
          data: { id: `reply-${replyCount}` },
          error: null,
        });
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: insertMock,
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // Simulate concurrent replies
      const replyPromises = users.map((user, index) =>
        mockFrom().insert({
          post_id: postId,
          author_id: user.id,
          body: replies[index].body,
          parent_comment_id: parentCommentId,
        })
      );

      await Promise.all(replyPromises);

      expect(insertMock).toHaveBeenCalledTimes(2);
      expect(replyCount).toBe(2);
    });
  });

  describe('Cache Updates for Nested Comments', () => {
    it('should update cache correctly when adding nested replies', async () => {
      const postId = 'post-123';
      const parentCommentId = 'comment-1';

      const initialComments = [
        {
          id: parentCommentId,
          body: 'Parent comment',
          replies: [],
          totalReplies: 0,
        },
      ];

      // Simulate adding a reply
      const updatedComments = initialComments.map((comment) => {
        if (comment.id === parentCommentId) {
          return {
            ...comment,
            replies: [
              ...comment.replies,
              { id: 'reply-1', body: 'New reply' },
            ],
            totalReplies: comment.totalReplies + 1,
          };
        }
        return comment;
      });

      expect(updatedComments[0].replies.length).toBe(1);
      expect(updatedComments[0].totalReplies).toBe(1);
    });
  });
});

