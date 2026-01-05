"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Post } from "@/components/PostsCard";
import { useProfile } from "@/hooks/useProfile";
import type { PostItem } from "@/hooks/usePosts";

export default function SavesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [savedPosts, setSavedPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch saved posts
  useEffect(() => {
    if (!mounted || profileLoading) return;

    let isMounted = true;

    const loadSavedPosts = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get current authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (!isMounted) return;
          setError("You must be signed in to view saved posts.");
          setLoading(false);
          return;
        }

        // Get all bookmarks for the current user
        const { data: bookmarksData, error: bookmarksError } = await supabase
          .from("bookmarks")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (bookmarksError) {
          console.error("Error loading bookmarks:", bookmarksError);
          if (!isMounted) return;
          setError("Failed to load saved posts. Please try again.");
          setLoading(false);
          return;
        }

        if (!bookmarksData || bookmarksData.length === 0) {
          if (!isMounted) return;
          setSavedPosts([]);
          setLoading(false);
          return;
        }

        const postIds = bookmarksData.map((b) => b.post_id);

        // Fetch posts data
        const { data: postsData, error: postsError } = await supabase
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
          .in("id", postIds)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false });

        if (postsError) {
          console.error("Error loading posts:", postsError);
          if (!isMounted) return;
          setError("Failed to load saved posts. Please try again.");
          setLoading(false);
          return;
        }

        if (!postsData || postsData.length === 0) {
          if (!isMounted) return;
          setSavedPosts([]);
          setLoading(false);
          return;
        }

        // Get all counts and user interactions in parallel
        const [
          { data: likesData },
          { data: userLikesData },
          { data: commentsData },
          { data: repostsData },
          { data: userRepostsData },
          { data: allBookmarksData },
          { data: userBookmarksData },
        ] = await Promise.all([
          supabase
            .from("post_likes")
            .select("post_id")
            .in("post_id", postIds),
          supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds),
          supabase
            .from("comments")
            .select("post_id")
            .in("post_id", postIds)
            .eq("is_deleted", false),
          supabase
            .from("reposts")
            .select("post_id")
            .in("post_id", postIds),
          supabase
            .from("reposts")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds),
          supabase
            .from("bookmarks")
            .select("post_id")
            .in("post_id", postIds),
          supabase
            .from("bookmarks")
            .select("post_id")
            .eq("user_id", user.id)
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
        (allBookmarksData ?? []).forEach((bookmark: any) => {
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

        if (!isMounted) return;
        setSavedPosts(mapped);
      } catch (err) {
        console.error("Unexpected error loading saved posts:", err);
        if (!isMounted) return;
        setError("An unexpected error occurred. Please try again.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSavedPosts();

    return () => {
      isMounted = false;
    };
  }, [mounted, profileLoading]);

  const handleLikeChange = (postId: string | number, newLikeCount: number, isLiked: boolean) => {
    setSavedPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, likeCount: newLikeCount, isLiked } : post
      )
    );
  };

  const handleRepostChange = (postId: string | number, newRepostCount: number, isReposted: boolean) => {
    setSavedPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, repostCount: newRepostCount, isReposted } : post
      )
    );
  };

  const handleBookmarkChange = (postId: string | number, newBookmarkCount: number, isBookmarked: boolean) => {
    // If unbookmarked, remove from the list
    if (!isBookmarked) {
      setSavedPosts((prev) => prev.filter((post) => post.id !== postId));
    } else {
      setSavedPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, bookmarkCount: newBookmarkCount, isBookmarked } : post
        )
      );
    }
  };

  if (!mounted || profileLoading) {
    return (
      <main className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center transition-colors">
        <div className="w-full max-w-2xl text-center p-4 text-[var(--text-secondary)]">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[var(--bg-primary)] min-h-screen py-6 md:py-10 flex flex-col items-center gap-6 transition-colors">
      {/* Header */}
      <div className="w-full max-w-2xl px-4 md:px-0">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-2">
            Saved Posts
          </h1>
          <p className="text-sm md:text-base text-[var(--text-secondary)]">
            Posts you've saved for later
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="w-full max-w-2xl px-4 md:px-0 text-center text-red-500 p-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="w-full max-w-2xl px-4 md:px-0 text-center p-4 text-[var(--text-secondary)]">
          Loading saved posts...
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && savedPosts.length === 0 && (
        <div className="w-full max-w-2xl px-4 md:px-0 flex flex-col items-center justify-center py-12 md:py-16">
          <div className="w-16 h-16 md:w-20 md:h-20 mb-4 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center">
            <svg
              className="w-8 h-8 md:w-10 md:h-10 text-[var(--text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-semibold text-[var(--text-primary)] mb-2">
            No saved posts yet
          </h2>
          <p className="text-sm md:text-base text-[var(--text-secondary)] text-center max-w-md">
            Start saving posts you want to revisit later. Click the bookmark icon on any post to save it.
          </p>
        </div>
      )}

      {/* Posts list */}
      {!loading && !error && savedPosts.length > 0 && (
        <div className="w-full max-w-2xl flex flex-col gap-1 px-4 md:px-0">
          {savedPosts.map((p) => (
            <Post
              key={p.id}
              id={p.id}
              name={p.name}
              text={p.text}
              created_at={p.created_at}
              gradYear={p.gradYear}
              image={p.image}
              images={p.images}
              avatar={p.avatar}
              authorId={p.authorId}
              likeCount={p.likeCount}
              isLiked={p.isLiked}
              commentCount={p.commentCount}
              repostCount={p.repostCount}
              isReposted={p.isReposted}
              bookmarkCount={p.bookmarkCount}
              isBookmarked={p.isBookmarked}
              onLikeChange={handleLikeChange}
              onRepostChange={handleRepostChange}
              onBookmarkChange={handleBookmarkChange}
              postType={p.postType}
              eventId={p.eventId}
              onClick={() => {
                router.push(`/posts/${p.id}`);
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

