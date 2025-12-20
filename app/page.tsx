"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Post } from "../components/PostsCard";
import { MakePost } from "@/components/MakePost";
import CreatePostModal from "@/components/CreatePostModal";
import { usePosts, PostItem } from "@/hooks/usePosts";
import { useProfile } from "@/hooks/useProfile";
import { invalidatePosts } from "@/utils/cacheInvalidation";

type NewPostPayload = {
  id: string;
  name: string;
  text: string;
  created_at: string;
  gradYear: string;
  images: string[];
};

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const postRef = useRef<HTMLDivElement | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Use React Query hooks for data fetching
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { data: posts = [], isLoading: loadingPosts, error: postsError } = usePosts();

  const userRole = profile?.role || null;

  useEffect(() => {
    // Only observe if user is admin and modal is not open
    if (userRole !== "admin" || showModal) {
      setShowBubble(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only show bubble when MakePost is out of view and modal is closed
        if (!showModal) {
          setShowBubble(!entry.isIntersecting);
        }
      },
      { threshold: 0.1 }
    );

    const el = postRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [userRole, showModal]);

  const openCreatePost = () => {
    if (userRole === "admin") {
      setShowModal(true);
    }
  };

  const handleCreatePost = (newPost: NewPostPayload) => {
    // Invalidate posts cache to refetch with new post
    if (profile?.university_id) {
      invalidatePosts(queryClient, profile.university_id);
    }
  };

  const handleLikeChange = (postId: string | number, newLikeCount: number, isLiked: boolean) => {
    // Optimistically update the cache
    queryClient.setQueryData<PostItem[]>(["posts", profile?.university_id], (old) => {
      if (!old) return old;
      return old.map((post) =>
        post.id === postId
          ? { ...post, likeCount: newLikeCount, isLiked }
          : post
      );
    });
  };

  const handleRepostChange = (postId: string | number, newRepostCount: number, isReposted: boolean) => {
    // Optimistically update the cache
    queryClient.setQueryData<PostItem[]>(["posts", profile?.university_id], (old) => {
      if (!old) return old;
      return old.map((post) =>
        post.id === postId
          ? { ...post, repostCount: newRepostCount, isReposted }
          : post
      );
    });
  };

  const handleBookmarkChange = (postId: string | number, newBookmarkCount: number, isBookmarked: boolean) => {
    // Optimistically update the cache
    queryClient.setQueryData<PostItem[]>(["posts", profile?.university_id], (old) => {
      if (!old) return old;
      return old.map((post) =>
        post.id === postId
          ? { ...post, bookmarkCount: newBookmarkCount, isBookmarked }
          : post
      );
    });
  };

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center gap-6 transition-colors">
      {/* MakePost with ref observed by IntersectionObserver - Only show for admin users */}
      {userRole === "admin" && (
      <div ref={postRef} className="w-full flex justify-center">
        <MakePost
          onStartPost={openCreatePost}
          onVideoClick={openCreatePost}
          onPhotoClick={openCreatePost}
        />
      </div>
      )}

      {/* Error states */}
      {profileError && (
        <div className="w-full max-w-2xl text-center text-red-500 p-4">
          {profileError instanceof Error
            ? profileError.message
            : "Error loading profile. Please try again."}
        </div>
      )}
      {postsError && (
        <div className="w-full max-w-2xl text-center text-red-500 p-4">
          {postsError instanceof Error
            ? postsError.message
            : "Error loading posts. Please try again."}
        </div>
      )}

      {/* Loading state */}
      {(loadingPosts || profileLoading) && (
        <div className="w-full max-w-2xl text-center p-4">Loading posts...</div>
      )}

      {/* Posts list */}
      <div className="w-full max-w-2xl flex flex-col gap-1">
        {posts.map((p) => (
          <div
            key={p.id}
            onClick={() => router.push(`/posts/${p.id}`)}
            className="cursor-pointer"
          >
            <Post
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
            />
          </div>
        ))}
      </div>

      {/* Floating circular bubble (appears only when MakePost is out of view, modal is closed, and user is admin) */}
      {showBubble && userRole === "admin" && !showModal && (
        <button
          onClick={openCreatePost}
          aria-label="Start a post"
          className="
      fixed
      bottom-20 right-[350px]        /* default: for large screens, bubble sits near posts */
      max-[1625px]:bottom-20          /* when screen < 1625px, move to bottom-right */
      max-[1625px]:right-5
      z-50
      flex h-20 w-20 items-center justify-center
      rounded-full bg-[var(--color-accent)] text-white shadow-xl
      hover:scale-105 active:scale-95 transition-transform
    "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}

      {/* Create post modal */}
      {showModal && (
        <CreatePostModal
          initialName=""
          initialGradYear=""
          onClose={() => setShowModal(false)}
          onSubmit={(post) => {
            handleCreatePost(post);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
