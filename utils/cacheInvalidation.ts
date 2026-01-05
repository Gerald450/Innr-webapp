/**
 * Cache invalidation utilities for React Query
 * Provides centralized helpers for invalidating cached data
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate posts cache
 */
export function invalidatePosts(queryClient: QueryClient, universityId?: string) {
  if (universityId) {
    queryClient.invalidateQueries({ queryKey: ["posts", universityId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }
}

/**
 * Invalidate profile cache
 */
export function invalidateProfile(queryClient: QueryClient, userId?: string) {
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }
  // Also invalidate avatar cache when profile changes
  queryClient.invalidateQueries({ queryKey: ["avatar"] });
}

/**
 * Invalidate events cache
 */
export function invalidateEvents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["events"] });
}

/**
 * Invalidate all user-related queries
 * Useful for logout or major profile changes
 */
export function invalidateAllUserData(queryClient: QueryClient, userId?: string) {
  invalidateProfile(queryClient, userId);
  invalidatePosts(queryClient);
  invalidateEvents(queryClient);
  queryClient.invalidateQueries({ queryKey: ["avatar"] });
}

/**
 * Clear all user-related cache (comprehensive invalidation)
 * Used on sign in/out to ensure fresh data is loaded
 * Invalidates all user-specific queries including nested ones
 */
export function clearAllUserCache(queryClient: QueryClient) {
  // Invalidate profile queries (with and without userId)
  queryClient.invalidateQueries({ queryKey: ["profile"] });
  
  // Invalidate avatar
  queryClient.invalidateQueries({ queryKey: ["avatar"] });
  
  // Invalidate posts (all variations)
  queryClient.invalidateQueries({ queryKey: ["posts"] });
  
  // Invalidate events (all variations)
  queryClient.invalidateQueries({ queryKey: ["events"] });
  
  // Invalidate individual post details
  queryClient.invalidateQueries({ 
    predicate: (query) => query.queryKey[0] === "post" 
  });
  
  // Invalidate comments
  queryClient.invalidateQueries({ 
    predicate: (query) => query.queryKey[0] === "comments" 
  });
  
  // Invalidate notifications
  queryClient.invalidateQueries({ 
    predicate: (query) => query.queryKey[0] === "notifications" 
  });
  
  // Remove all cached data (more aggressive - clears everything)
  queryClient.clear();
}

/**
 * Invalidate post detail cache
 */
export function invalidatePostDetail(queryClient: QueryClient, postId: string) {
  queryClient.invalidateQueries({ queryKey: ["post", postId] });
}

/**
 * Invalidate comments cache for a post
 */
export function invalidateComments(queryClient: QueryClient, postId: string) {
  queryClient.invalidateQueries({ queryKey: ["comments", postId] });
}

