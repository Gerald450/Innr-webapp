"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Post } from "@/components/PostsCard";
import Comments from "@/components/Comments";
import { invalidatePosts } from "@/utils/cacheInvalidation";
import { setProfileRefreshNeeded } from "@/utils/storage";

type PostDetail = {
  id: string;
  name: string;
  text: string;
  title?: string;
  created_at: string;
  gradYear: string;
  image: string;
  images?: string[];
  avatar?: string;
  authorId?: string;
  likeCount?: number;
  isLiked?: boolean;
  comments?: number;
  repostCount?: number;
  isReposted?: boolean;
  bookmarkCount?: number;
  isBookmarked?: boolean;
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const postId = params?.id as string;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  // Store referrer on mount for navigation after deletion
  useEffect(() => {
    if (typeof window !== "undefined" && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        const currentUrl = new URL(window.location.href);
        // Only store if referrer is from the same origin
        if (referrerUrl.origin === currentUrl.origin) {
          sessionStorage.setItem("postDetailReferrer", referrerUrl.pathname + referrerUrl.search);
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }
  }, []);

  useEffect(() => {
    if (!postId) return;

    let mounted = true;

    const loadPost = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get user first (can be done in parallel with post fetch)
        const [{ data: { user } }, { data: postData, error: postErr }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("posts")
            .select(
              `
              id,
              title,
              body,
              created_at,
              author_id,
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
            .eq("id", postId)
            .eq("is_deleted", false)
            .single(),
        ]);

        if (user && mounted) {
          setCurrentUserId(user.id);
        }

        if (postErr || !postData) {
          console.error("Error loading post:", postErr);
          if (!mounted) return;
          setError("Post not found");
          return;
        }

        if (!mounted) return;

        const postDataTyped = postData as any;

        const author = postDataTyped.profiles as any | null;
        const media = (postDataTyped.post_media as any[]) ?? [];
        const sortedMedia = media
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const allImages = sortedMedia.map((m: any) => m.url).filter(Boolean);
        const firstMedia = sortedMedia[0] ?? null;

        const postIdFromData = postDataTyped.id;

        // Execute all count queries and event check in parallel
        const [
          { data: likesData },
          { data: commentsData },
          { data: repostsData },
          { data: bookmarksData },
          { data: eventData, error: eventError },
        ] = await Promise.all([
          supabase
            .from("post_likes")
            .select("user_id")
            .eq("post_id", postIdFromData),
          supabase
            .from("comments")
            .select("id")
            .eq("post_id", postIdFromData)
            .eq("is_deleted", false),
          supabase
            .from("reposts")
            .select("user_id")
            .eq("post_id", postIdFromData),
          supabase
            .from("bookmarks")
            .select("user_id")
            .eq("post_id", postIdFromData),
          supabase
            .from("events")
            .select("id")
            .eq("post_id", postIdFromData)
            .single(),
        ]);

        const likeCount = likesData?.length || 0;
        const isLiked = user
          ? (likesData ?? []).some((like: any) => like.user_id === user.id)
          : false;

        const commentCount = commentsData?.length || 0;

        const repostCount = repostsData?.length || 0;
        const isReposted = user
          ? (repostsData ?? []).some((repost: any) => repost.user_id === user.id)
          : false;

        const bookmarkCount = bookmarksData?.length || 0;
        const isBookmarked = user
          ? (bookmarksData ?? []).some((bookmark: any) => bookmark.user_id === user.id)
          : false;

        const postDetail: PostDetail = {
          id: postIdFromData,
          name: author?.full_name ?? "Unknown",
          text: (postData as any).body ?? "",
          title: postDataTyped.title ? String(postDataTyped.title).trim() : undefined,
          created_at: postDataTyped.created_at,
          gradYear:
            author?.graduation_year != null
              ? String(author.graduation_year).slice(-2)
              : "",
          image: firstMedia?.url ?? "",
          images: allImages.length > 0 ? allImages : undefined,
          avatar: author?.avatar_url ?? undefined,
          authorId: postDataTyped.author_id,
          likeCount,
          isLiked,
          comments: commentCount,
          repostCount,
          isReposted,
          bookmarkCount,
          isBookmarked,
        };

        setPost(postDetail);
        
        // Set event ID if event exists (ignore error if no event found)
        if (!mounted) return;
        if (eventData && !eventError) {
          setEventId((eventData as any).id);
        } else {
          setEventId(null);
        }
      } catch (err) {
        console.error("Unexpected error loading post:", err);
        if (mounted) setError("Failed to load post");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPost();

    return () => {
      mounted = false;
    };
  }, [postId]);

  // Memoize callbacks to prevent infinite loops
  const handleLikeChange = useCallback((postId: string | number, newLikeCount: number, isLiked: boolean) => {
    setPost((prev) => prev ? { ...prev, likeCount: newLikeCount, isLiked } : null);
  }, []);

  const handleCommentCountChange = useCallback((count: number) => {
    setPost((prev) => prev ? { ...prev, comments: count } : null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="text-lg text-[var(--text-secondary)]">Loading post...</div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 transition-colors">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {error || "Post not found"}
          </h1>
          <p className="text-[var(--text-secondary)] mb-4">
            The post you're looking for doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-10 flex flex-col items-center px-4 transition-colors">
      <div className="w-full max-w-2xl">
        {/* Back button and View Event button */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          
          {eventId && (
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="text-sm font-medium text-[var(--color-accent)] hover:text-[color-mix(in_oklab,var(--color-accent)_85%,black)] flex items-center gap-2 transition-colors px-4 py-2 rounded-lg border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/10"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              View Event
            </button>
          )}
        </div>

        {/* Post */}
        <div className="mb-6">
          <Post
            id={post.id}
            name={post.name}
            gradYear={post.gradYear}
            avatar={post.avatar}
            title={post.title}
            text={post.text}
            created_at={post.created_at}
            image={post.image}
            images={post.images}
            authorId={post.authorId}
            likeCount={post.likeCount}
            isLiked={post.isLiked}
            commentCount={post.comments}
            repostCount={post.repostCount}
            isReposted={post.isReposted}
            isAuthor={currentUserId === post.authorId}
            showMenu={true}
            onLikeChange={handleLikeChange}
            onPostUpdate={(postId, newText) => {
              setProfileRefreshNeeded();
              setPost((prev) => prev ? { ...prev, text: newText } : null);
            }}
            onPostDelete={async () => {
              setProfileRefreshNeeded();
              invalidatePosts(queryClient);
              
              const referrer = sessionStorage.getItem("postDetailReferrer");
              sessionStorage.removeItem("postDetailReferrer");
              
              if (referrer && typeof window !== "undefined" && referrer !== window.location.pathname) {
                router.push(referrer);
              } else {
                router.back();
              }
            }}
          />
        </div>

        {/* Engagement Stats */}
        <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] p-4 mb-6 transition-colors">
          <div className="flex items-center justify-around text-sm">
            <div className="text-center">
              <div className="font-semibold text-[var(--text-primary)]">{post.likeCount ?? 0}</div>
              <div className="text-[var(--text-secondary)]">Likes</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-[var(--text-primary)]">{post.comments ?? 0}</div>
              <div className="text-[var(--text-secondary)]">Comments</div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] p-4 transition-colors">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Comments</h2>
          <Comments 
            postId={postId} 
            onCommentCountChange={handleCommentCountChange}
          />
        </div>
      </div>
    </div>
  );
}

