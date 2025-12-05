"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Post } from "../components/PostsCard";
import { MakePost } from "@/components/MakePost";
import CreatePostModal from "@/components/CreatePostModal";

type PostItem = {
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
};

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
  const postRef = useRef<HTMLDivElement | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBubble(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    const el = postRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, []);

  // Load posts from Supabase for the current user's university
  useEffect(() => {
    let mounted = true;

    const loadPosts = async () => {
      setLoadingPosts(true);
      setPostsError(null);

      try {
        // 1) Get current authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error("Auth error while loading posts:", authError);
          if (!mounted) return;
          setPostsError("Error checking authentication.");
          return;
        }

        if (!user) {
          if (!mounted) return;
          setPostsError("You must be signed in to see posts.");
          return;
        }

        // 2) Fetch the user's profile to get university_id and role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("university_id, full_name, graduation_year, avatar_url, role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Failed to load profile for posts:", {
            error: profileError,
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            userId: user.id,
          });
          // Check if it's a "not found" error (PGRST116) or RLS issue
          if (profileError.code === "PGRST116" || profileError.message?.includes("No rows")) {
            if (!mounted) return;
            setPostsError("Profile not found. Please complete your profile setup.");
            setLoadingPosts(false);
            return;
          }
          // Check for RLS policy violation
          if (profileError.code === "42501" || profileError.message?.includes("row-level security")) {
            if (!mounted) return;
            setPostsError("Access denied. Please check your account permissions.");
            setLoadingPosts(false);
            return;
          }
          if (!mounted) return;
          setPostsError("Unable to load your profile. Please try again.");
          setLoadingPosts(false);
          return;
        }

        if (!profile) {
          if (!mounted) return;
          setPostsError("Profile not found. Please complete your profile setup.");
          setLoadingPosts(false);
          return;
        }

        // Set user role for conditional rendering
        if (mounted) {
          setUserRole((profile as any).role || null);
        }

        const universityId = (profile as any).university_id;
        if (!universityId) {
          if (!mounted) return;
          setPostsError("Your profile is missing a university.");
          return;
        }

        // 3) Load posts for this university, including author profile + media
        const { data: postsData, error: postsErr } = await supabase
          .from("posts")
          .select(
            `
            id,
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
          .eq("university_id", universityId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false });

        // 4) Get like counts and check if current user has liked each post
        const postIds = (postsData ?? []).map((p: any) => p.id);
        
        // Get like counts for all posts
        const { data: likesData } = await supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", postIds);

        // Get user's likes
        const { data: userLikesData } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

        // Get comment counts for all posts
        const { data: commentsData } = await supabase
          .from("comments")
          .select("post_id")
          .in("post_id", postIds)
          .eq("is_deleted", false);

        // Get repost counts for all posts
        const { data: repostsData } = await supabase
          .from("reposts")
          .select("post_id")
          .in("post_id", postIds);

        // Get user's reposts
        const { data: userRepostsData } = await supabase
          .from("reposts")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

        // Get bookmark counts for all posts
        const { data: bookmarksData } = await supabase
          .from("bookmarks")
          .select("post_id")
          .in("post_id", postIds);

        // Get user's bookmarks
        const { data: userBookmarksData } = await supabase
          .from("bookmarks")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

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

        if (postsErr) {
          console.error("Error loading posts:", postsErr);
          if (!mounted) return;
          setPostsError("Unable to load posts.");
          return;
        }

        if (!mounted) return;

        const mapped: PostItem[] =
          (postsData ?? []).map((row: any) => {
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
            };
          }) as PostItem[];

        setPosts(mapped);
      } catch (err) {
        console.error("Unexpected error loading posts:", err);
        if (mounted) setPostsError("Unexpected error loading posts.");
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    };

    loadPosts();

    return () => {
      mounted = false;
    };
  }, []);

  const openCreatePost = () => {
    if (userRole === "admin") {
      setShowModal(true);
    }
  };

  const handleCreatePost = (newPost: NewPostPayload) => {
    const postWithId: PostItem = {
      id:
        typeof newPost.id === "number" ? (newPost.id as any as number) : Date.now(),
      name: newPost.name,
      text: newPost.text,
      created_at: newPost.created_at ?? new Date().toISOString(),
      gradYear: newPost.gradYear,
      image: newPost.images[0] ?? "",
      avatar: undefined,
      likeCount: 0,
      isLiked: false,
      repostCount: 0,
      isReposted: false,
      bookmarkCount: 0,
      isBookmarked: false,
    };

    setPosts((prev) => [postWithId, ...prev]);
  };

  const handleLikeChange = (postId: string | number, newLikeCount: number, isLiked: boolean) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, likeCount: newLikeCount, isLiked }
          : post
      )
    );
  };

  const handleRepostChange = (postId: string | number, newRepostCount: number, isReposted: boolean) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, repostCount: newRepostCount, isReposted }
          : post
      )
    );
  };

  const handleBookmarkChange = (postId: string | number, newBookmarkCount: number, isBookmarked: boolean) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, bookmarkCount: newBookmarkCount, isBookmarked }
          : post
      )
    );
  };

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center gap-6 transition-colors">
      {/* MakePost with ref observed by IntersectionObserver - Only show for admin users */}
      {userRole === "admin" && (
      <div ref={postRef} className="w-full flex justify-center">
        <MakePost
          onStartPost={openCreatePost}
          onVideoClick={() => console.log("open video upload")}
          onPhotoClick={() => console.log("open photo upload")}
          onArticleClick={() => console.log("open write-article editor")}
        />
      </div>
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

      {/* Floating circular bubble (appears only when MakePost is out of view and user is admin) */}
      {showBubble && userRole === "admin" && (
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
