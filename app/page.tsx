"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Post } from "../components/Posts";
import { MakePost } from "@/components/MakePost";
import CreatePostModal from "@/components/CreatePostModal";

type PostItem = {
  id: number | string;
  name: string;
  text: string;
  time: string;
  gradYear: string;
  image: string;
  images?: string[];
  avatar?: string;
};

type NewPostPayload = {
  id: string;
  name: string;
  text: string;
  time: string;
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

        // 2) Fetch the user's profile to get university_id
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("university_id, full_name, graduation_year, avatar_url")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          console.error("Failed to load profile for posts:", profileError);
          if (!mounted) return;
          setPostsError("Unable to load your profile.");
          return;
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
              time: new Date(row.created_at).toLocaleString(),
              gradYear:
                author?.graduation_year != null
                  ? String(author.graduation_year).slice(-2)
                  : "",
              image: firstMedia?.url ?? "",
              images: allImages.length > 0 ? allImages : undefined,
              avatar: author?.avatar_url ?? undefined,
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

  const openCreatePost = () => setShowModal(true);

  const handleCreatePost = (newPost: NewPostPayload) => {
    const postWithId: PostItem = {
      id:
        typeof newPost.id === "number" ? (newPost.id as any as number) : Date.now(),
      name: newPost.name,
      text: newPost.text,
      time: newPost.time ?? "just now",
      gradYear: newPost.gradYear,
      image: newPost.images[0] ?? "",
      avatar: undefined,
    };

    setPosts((prev) => [postWithId, ...prev]);
  };

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center gap-6 transition-colors">
      {/* MakePost with ref observed by IntersectionObserver */}
      <div ref={postRef} className="w-full flex justify-center">
        <MakePost
          onStartPost={openCreatePost}
          onVideoClick={() => console.log("open video upload")}
          onPhotoClick={() => console.log("open photo upload")}
          onArticleClick={() => console.log("open write-article editor")}
        />
      </div>

      {/* Posts list */}
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {posts.map((p) => (
          <div
            key={p.id}
            onClick={() => router.push(`/posts/${p.id}`)}
            className="cursor-pointer"
          >
            <Post
              name={p.name}
              text={p.text}
              time={p.time}
              gradYear={p.gradYear}
              image={p.image}
              images={p.images}
              avatar={p.avatar}
            />
          </div>
        ))}
      </div>

      {/* Floating circular bubble (appears only when MakePost is out of view) */}
      {showBubble && (
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
