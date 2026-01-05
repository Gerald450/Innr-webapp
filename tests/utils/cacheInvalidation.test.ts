import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidatePosts,
  invalidateProfile,
  invalidateEvents,
  invalidateAllUserData,
  clearAllUserCache,
  invalidatePostDetail,
  invalidateComments,
} from '@/utils/cacheInvalidation';

describe('Cache invalidation utilities', () => {
  let queryClient: QueryClient;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    invalidateQueriesSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('invalidatePosts', () => {
    it('should invalidate posts query with university ID', () => {
      invalidatePosts(queryClient, 'uni-123');

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['posts', 'uni-123'],
      });
    });

    it('should invalidate all posts queries when university ID is not provided', () => {
      invalidatePosts(queryClient);

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['posts'],
      });
    });
  });

  describe('invalidateProfile', () => {
    it('should invalidate profile query with user ID', () => {
      invalidateProfile(queryClient, 'user-123');

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
      expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(1, {
        queryKey: ['profile', 'user-123'],
      });
      expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(2, {
        queryKey: ['avatar'],
      });
    });

    it('should invalidate all profile queries when user ID is not provided', () => {
      invalidateProfile(queryClient);

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
      expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(1, {
        queryKey: ['profile'],
      });
      expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(2, {
        queryKey: ['avatar'],
      });
    });
  });

  describe('invalidateEvents', () => {
    it('should invalidate events query', () => {
      invalidateEvents(queryClient);

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['events'],
      });
    });
  });

  describe('invalidateAllUserData', () => {
    it('should invalidate all user-related queries', () => {
      invalidateAllUserData(queryClient, 'user-123');

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(5);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['profile', 'user-123'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['posts'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['events'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['avatar'],
      });
    });

    it('should invalidate all user-related queries without user ID', () => {
      invalidateAllUserData(queryClient);

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(5);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['profile'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['posts'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['events'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['avatar'],
      });
    });
  });

  describe('clearAllUserCache', () => {
    it('should clear all user-related cache including nested queries', () => {
      const clearSpy = vi.spyOn(queryClient, 'clear');
      clearSpy.mockReturnValue(undefined);

      clearAllUserCache(queryClient);

      // Should invalidate multiple query keys
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['profile'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['avatar'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['posts'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['events'],
      });
      
      // Should use predicate for nested queries
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        predicate: expect.any(Function),
      });

      // Should clear all cached data
      expect(clearSpy).toHaveBeenCalled();

      clearSpy.mockRestore();
    });

    it('should use predicate function to match post queries', () => {
      clearAllUserCache(queryClient);

      // Find the predicate call for posts
      const predicateCalls = invalidateQueriesSpy.mock.calls.filter(
        (call) => call[0]?.predicate
      );

      // Test the predicate function for post queries
      const postPredicate = predicateCalls.find(
        (call) => call[0]?.predicate({ queryKey: ['post', '123'] })
      );
      expect(postPredicate).toBeDefined();

      // Test the predicate function for comment queries
      const commentPredicate = predicateCalls.find(
        (call) => call[0]?.predicate({ queryKey: ['comments', '123'] })
      );
      expect(commentPredicate).toBeDefined();

      // Test the predicate function for notification queries
      const notificationPredicate = predicateCalls.find(
        (call) => call[0]?.predicate({ queryKey: ['notifications'] })
      );
      expect(notificationPredicate).toBeDefined();
    });
  });

  describe('invalidatePostDetail', () => {
    it('should invalidate post detail query', () => {
      invalidatePostDetail(queryClient, 'post-123');

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['post', 'post-123'],
      });
    });
  });

  describe('invalidateComments', () => {
    it('should invalidate comments query for a post', () => {
      invalidateComments(queryClient, 'post-123');

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['comments', 'post-123'],
      });
    });
  });
});

