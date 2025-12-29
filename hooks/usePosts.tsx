"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "./useProfile";

export type PostItem = {
  id: number | string;
  name: string;
  text: string;
  created_at: string;
  gradYear: string;
  image: string;
  images?: string[];
  avatar?: string;
  authorId?: string;
  likeCount?: number;
  isLiked?: boolean;
  commentCount?: number;
  repostCount?: number;
  isReposted?: boolean;
  bookmarkCount?: number;
  isBookmarked?: boolean;
  postType?: string;
  eventId?: string;
};

async function fetchPosts(universityId: string, userId: string): Promise<PostItem[]> {
  // 1) Load posts for this university, including author profile + media + post_type
  const { data: postsData, error: postsErr } = await supabase
    .from("posts")
    .select(
      `
      id,
      body,
      created_at,
      author_id,
      post_type,
      profiles (
        full_name,
        graduation_year,
        avatar_url
      ),
      post_media (
        url,
        order_index
      )
    `
    )
    .eq("university_id", universityId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(30);

  if (postsErr) {
    throw new Error(`Unable to load posts: ${postsErr.message}`);
  }

  if (!postsData || postsData.length === 0) {
    return [];
  }

  // 2) Get all counts and user interactions in parallel
  const postIds = postsData.map((p: any) => p.id);

  const [
    { data: likesData },
    { data: userLikesData },
    { data: commentsData },
    { data: repostsData },
    { data: userRepostsData },
    { data: bookmarksData },
    { data: userBookmarksData },
  ] = await Promise.all([
    // Get like counts for all posts
    supabase
      .from("post_likes")
      .select("post_id")
      .in("post_id", postIds),
    // Get user's likes
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    // Get comment counts for all posts
    supabase
      .from("comments")
      .select("post_id")
      .in("post_id", postIds)
      .eq("is_deleted", false),
    // Get repost counts for all posts
    supabase
      .from("reposts")
      .select("post_id")
      .in("post_id", postIds),
    // Get user's reposts
    supabase
      .from("reposts")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    // Get bookmark counts for all posts
    supabase
      .from("bookmarks")
      .select("post_id")
      .in("post_id", postIds),
    // Get user's bookmarks
    supabase
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
  ]);

  // Create maps for quick lookup
  const likeCountMap: Record<string, number> = {};
  const commentCountMap: Record<string, number> = {};
  const repostCountMap: Record<string, number> = {};
  const bookmarkCountMap: Record<string, number> = {};
  const userLikedSet = new Set(
    (userLikesData ?? []).map((like: any) => like.post_id)
  );
  const userRepostedSet = new Set(
    (userRepostsData ?? []).map((repost: any) => repost.post_id)
  );
  const userBookmarkedSet = new Set(
    (userBookmarksData ?? []).map((bookmark: any) => bookmark.post_id)
  );

  // Count likes per post
  (likesData ?? []).forEach((like: any) => {
    likeCountMap[like.post_id] = (likeCountMap[like.post_id] || 0) + 1;
  });

  // Count comments per post
  (commentsData ?? []).forEach((comment: any) => {
    commentCountMap[comment.post_id] = (commentCountMap[comment.post_id] || 0) + 1;
  });

  // Count reposts per post
  (repostsData ?? []).forEach((repost: any) => {
    repostCountMap[repost.post_id] = (repostCountMap[repost.post_id] || 0) + 1;
  });

  // Count bookmarks per post
  (bookmarksData ?? []).forEach((bookmark: any) => {
    bookmarkCountMap[bookmark.post_id] = (bookmarkCountMap[bookmark.post_id] || 0) + 1;
  });

  // Get event IDs for event posts
  const eventPostIds = postsData
    .filter((row: any) => row.post_type === "event")
    .map((row: any) => row.id);

  let eventIdMap: Record<string, string> = {};
  if (eventPostIds.length > 0) {
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, post_id")
      .in("post_id", eventPostIds);

    if (eventsData) {
      eventsData.forEach((event: any) => {
        eventIdMap[event.post_id] = event.id;
      });
    }
  }

  // Map posts to PostItem format
  const mapped: PostItem[] = postsData.map((row: any) => {
    const author = row.profiles as any | null;
    const media = (row.post_media as any[]) ?? [];
    const sortedMedia = media
      .slice()
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const allImages = sortedMedia.map((m: any) => m.url).filter(Boolean);
    const firstMedia = sortedMedia[0] ?? null;

    return {
      id: row.id,
      name: author?.full_name ?? "Unknown",
      text: row.body ?? "",
      created_at: row.created_at,
      gradYear:
        author?.graduation_year != null
          ? String(author.graduation_year).slice(-2)
          : "",
      image: firstMedia?.url ?? "",
      images: allImages.length > 0 ? allImages : undefined,
      avatar: author?.avatar_url ?? undefined,
      authorId: row.author_id,
      likeCount: likeCountMap[row.id] || 0,
      isLiked: userLikedSet.has(row.id),
      commentCount: commentCountMap[row.id] || 0,
      repostCount: repostCountMap[row.id] || 0,
      isReposted: userRepostedSet.has(row.id),
      bookmarkCount: bookmarkCountMap[row.id] || 0,
      isBookmarked: userBookmarkedSet.has(row.id),
      postType: row.post_type || "text",
      eventId: row.post_type === "event" ? eventIdMap[row.id] : undefined,
    };
  });

  return mapped;
}

export function usePosts() {
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();

  return useQuery({
    queryKey: ["posts", profile?.university_id],
    queryFn: async () => {
      if (!profile?.university_id) {
        throw new Error("University ID not found in profile");
      }

      // Get current authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      return fetchPosts(profile.university_id, user.id);
    },
    enabled: !!profile?.university_id && !profileLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      if (error?.message === "Not authenticated" || error?.message?.includes("University ID")) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

