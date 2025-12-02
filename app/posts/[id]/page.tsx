"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Post } from "@/components/Posts";

type PostDetail = {
  id: string;
  name: string;
  text: string;
  time: string;
  gradYear: string;
  image: string;
  avatar?: string;
  likes?: number;
  comments?: number;
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params?.id as string;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;

    let mounted = true;

    const loadPost = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: postData, error: postErr } = await supabase
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
          .eq("id", postId)
          .eq("is_deleted", false)
          .single();

        if (postErr || !postData) {
          console.error("Error loading post:", postErr);
          if (!mounted) return;
          setError("Post not found");
          return;
        }

        if (!mounted) return;

        const author = (postData as any).profiles as any | null;
        const media = ((postData as any).post_media as any[]) ?? [];
        const firstMedia =
          media
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0] ??
          null;

        // TODO: Load actual likes and comments count from database
        const postDetail: PostDetail = {
          id: (postData as any).id,
          name: author?.full_name ?? "Unknown",
          text: (postData as any).body ?? "",
          time: new Date((postData as any).created_at).toLocaleString(),
          gradYear:
            author?.graduation_year != null
              ? String(author.graduation_year).slice(-2)
              : "",
          image: firstMedia?.url ?? "",
          avatar: author?.avatar_url ?? undefined,
          likes: 0, // TODO: Get from likes table
          comments: 0, // TODO: Get from comments table
        };

        setPost(postDetail);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-slate-600">Loading post...</div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            {error || "Post not found"}
          </h1>
          <p className="text-slate-600 mb-4">
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
    <div className="min-h-screen bg-[#F2F4F7] py-10 flex flex-col items-center px-4">
      <div className="w-full max-w-2xl">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-2"
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

        {/* Post */}
        <div className="mb-6">
          <Post
            name={post.name}
            gradYear={post.gradYear}
            avatar={post.avatar}
            text={post.text}
            time={post.time}
            image={post.image}
          />
        </div>

        {/* Engagement Stats */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
          <div className="flex items-center justify-around text-sm">
            <div className="text-center">
              <div className="font-semibold text-slate-900">{post.likes ?? 0}</div>
              <div className="text-slate-500">Likes</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-900">{post.comments ?? 0}</div>
              <div className="text-slate-500">Comments</div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <h2 className="font-semibold text-slate-900 mb-4">Comments</h2>
          <div className="text-center py-8 text-sm text-slate-500">
            Comments feature coming soon
          </div>
        </div>
      </div>
    </div>
  );
}

