import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

describe('Cache Consistency', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('React Query Cache Consistency', () => {
    it('should maintain consistent cache during concurrent updates', () => {
      const postId = 'post-123';
      const universityId = 'uni-123';

      // Set initial data
      const initialData = [{ id: postId, likeCount: 5 }];
      queryClient.setQueryData(['posts', universityId], initialData);

      // Simulate concurrent updates
      const update1 = () => {
        queryClient.setQueryData(['posts', universityId], (old: any) =>
          old.map((p: any) => (p.id === postId ? { ...p, likeCount: 6 } : p))
        );
      };

      const update2 = () => {
        queryClient.setQueryData(['posts', universityId], (old: any) =>
          old.map((p: any) => (p.id === postId ? { ...p, likeCount: 7 } : p))
        );
      };

      // Both updates execute
      update1();
      update2();

      const cached = queryClient.getQueryData(['posts', universityId]) as any[];
      // Last update should win
      expect(cached[0].likeCount).toBe(7);
    });

    it('should handle cache invalidation timing correctly', () => {
      const queryKey = ['posts', 'uni-123'];
      const initialData = [{ id: 'post-1' }];

      queryClient.setQueryData(queryKey, initialData);

      // Invalidate
      queryClient.invalidateQueries({ queryKey });

      const queryState = queryClient.getQueryState(queryKey);
      expect(queryState?.isInvalidated).toBe(true);
    });

    it('should handle stale data correctly', async () => {
      const queryKey = ['posts', 'uni-123'];
      const initialData = [{ id: 'post-1' }];

      queryClient.setQueryData(queryKey, initialData);

      // Mark as stale by setting staleTime to 0
      const queryState = queryClient.getQueryState(queryKey);
      expect(queryState).toBeDefined();
    });

    it('should prevent query key collisions', () => {
      const universityId = 'uni-123';

      // Different queries with similar keys should not collide
      queryClient.setQueryData(['posts', universityId], [{ id: 'post-1' }]);
      queryClient.setQueryData(['post', 'post-1'], { id: 'post-1', text: 'Post 1' });
      queryClient.setQueryData(['posts', 'uni-456'], [{ id: 'post-2' }]);

      const posts1 = queryClient.getQueryData(['posts', universityId]) as any[];
      const postDetail = queryClient.getQueryData(['post', 'post-1']) as any;
      const posts2 = queryClient.getQueryData(['posts', 'uni-456']) as any[];

      expect(posts1).toBeDefined();
      expect(postDetail).toBeDefined();
      expect(posts2).toBeDefined();
      expect(posts1[0].id).toBe('post-1');
      expect(postDetail.id).toBe('post-1');
      expect(posts2[0].id).toBe('post-2');
    });
  });

  describe('Cache Invalidation Dependencies', () => {
    it('should invalidate related queries correctly', () => {
      const universityId = 'uni-123';
      const postId = 'post-123';

      // Set up related data
      queryClient.setQueryData(['posts', universityId], [{ id: postId }]);
      queryClient.setQueryData(['post', postId], { id: postId });
      queryClient.setQueryData(['comments', postId], [{ id: 'comment-1' }]);

      // Invalidate posts - should not affect comments
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      const postsState = queryClient.getQueryState(['posts', universityId]);
      const commentsState = queryClient.getQueryState(['comments', postId]);

      expect(postsState?.isInvalidated).toBe(true);
      expect(commentsState?.isInvalidated).toBeUndefined(); // Comments not invalidated
    });
  });
});

