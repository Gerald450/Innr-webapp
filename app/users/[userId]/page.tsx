"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import { Post } from "@/components/Posts";

type PostItem = {
  id: string;
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
};

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;
  const [profile, setProfile] = useState<any | null>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "activity" | "about">("posts");
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [activityType, setActivityType] = useState<"liked" | "commented" | "reposted">("liked");
  const [activityPosts, setActivityPosts] = useState<PostItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // Check if this is the current user's profile
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (currentUser?.id === userId) {
          if (!mounted) return;
          setIsOwnProfile(true);
          router.push("/profile");
          return;
        }

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, program_of_study, bio, avatar_url, graduation_year")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.warn("Profile fetch error:", profileError);
          if (!mounted) return;
          setErrorMsg("Profile not found.");
          setProfile(null);
        } else {
          if (!mounted) return;
          setProfile(profileData ?? null);
        }

        if (mounted) setLoading(false);
      } catch (err) {
        console.error("Unexpected load error:", err);
        if (mounted) setErrorMsg("Unexpected error loading profile.");
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId, router]);

  // Load user's posts when Posts tab is active
  useEffect(() => {
    if (activeTab !== "posts" || !profile?.id) return;

    let mounted = true;

    const loadUserPosts = async () => {
      setLoadingPosts(true);

      try {
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
          .eq("author_id", profile.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false });

        if (postsErr) {
          console.error("Error loading user posts:", postsErr);
          if (!mounted) return;
          return;
        }

        if (!mounted) return;

        // Get like counts and check if current user has liked each post
        const postIds = (postsData ?? []).map((p: any) => p.id);

        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;

        // Get like counts for all posts
        const { data: likesData } = await supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", postIds);

        // Get user's likes
        const { data: userLikesData } = currentUserId
          ? await supabase
              .from("post_likes")
              .select("post_id")
              .eq("user_id", currentUserId)
              .in("post_id", postIds)
          : { data: null };

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
        const { data: userRepostsData } = currentUserId
          ? await supabase
              .from("reposts")
              .select("post_id")
              .eq("user_id", currentUserId)
              .in("post_id", postIds)
          : { data: null };

        // Create maps for quick lookup
        const likeCountMap: Record<string, number> = {};
        const commentCountMap: Record<string, number> = {};
        const repostCountMap: Record<string, number> = {};
        const userLikedSet = new Set(
          (userLikesData ?? []).map((like: any) => like.post_id)
        );
        const userRepostedSet = new Set(
          (userRepostsData ?? []).map((repost: any) => repost.post_id)
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
            };
          }) as PostItem[];

        setUserPosts(mapped);
      } catch (err) {
        console.error("Unexpected error loading user posts:", err);
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    };

    loadUserPosts();

    return () => {
      mounted = false;
    };
  }, [activeTab, profile?.id]);

  if (loading) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex justify-center items-center px-4 transition-colors">
        <div className="text-center">
          <div className="text-lg text-slate-600">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (errorMsg || !profile) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex justify-center px-4 transition-colors">
        <div className="w-full max-w-6xl">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4 text-[var(--text-primary)]">Profile Not Found</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">{errorMsg || "The user profile you're looking for doesn't exist."}</p>
            <button
              onClick={() => router.back()}
              className="px-6 h-11 rounded-lg bg-[var(--color-accent)] text-white font-semibold hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center px-4 transition-colors">
      <div className="w-full max-w-6xl">
        {/* Profile Header - Centered */}
        <div className="flex flex-col items-center mb-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm mb-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "Profile"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-3xl">
                {profile.full_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>

          {/* Name + Grad Year */}
          <div className="flex items-center gap-2 flex-wrap justify-center mb-2">
            <h2 className="font-semibold text-xl text-[var(--text-primary)]">
              {profile.full_name || "Unknown User"}
            </h2>
            {profile.graduation_year && (
              <span className="flex items-center gap-1 text-sm text-[var(--text-secondary)] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                <img
                  src="/svgs/graduate.svg"
                  alt="Graduate"
                  className="h-3 w-3"
                />
                {String(profile.graduation_year).slice(-2)}
              </span>
            )}
          </div>

          {/* Program of Study */}
          {profile.program_of_study && (
            <div className="text-sm text-[var(--text-secondary)] mb-2 text-center">
              {profile.program_of_study}
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line text-center max-w-2xl mb-4">
              {profile.bio}
            </div>
          )}
        </div>

        {/* Tabs Card */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] overflow-hidden transition-colors">
          {/* Tabs */}
          <div className="border-b border-[var(--card-border)]">
            <div className="flex text-sm font-medium">
              <button
                onClick={() => setActiveTab("posts")}
                className={`flex-1 text-center py-4 border-b-2 transition-colors ${
                  activeTab === "posts"
                    ? "text-[var(--text-primary)] border-[var(--color-accent)] font-semibold"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                }`}
              >
                Posts
              </button>
              <button
                onClick={() => setActiveTab("about")}
                className={`flex-1 text-center py-4 border-b-2 transition-colors ${
                  activeTab === "about"
                    ? "text-[var(--text-primary)] border-[var(--color-accent)] font-semibold"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                }`}
              >
                About
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "posts" && (
              <div>
                {loadingPosts ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-slate-500">Loading posts...</div>
                  </div>
                ) : userPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-slate-500 mb-2">
                      No posts yet.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userPosts.map((post) => {
                      const hasMedia = post.image || (post.images && post.images.length > 0);
                      return (
                        <div
                          key={post.id}
                          onClick={() => router.push(`/posts/${post.id}`)}
                          className={`cursor-pointer group relative rounded-lg overflow-hidden border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg ${
                            hasMedia 
                              ? "aspect-square bg-gray-100 dark:bg-gray-800" 
                              : "bg-[var(--card-bg)] min-h-[120px] max-h-[200px]"
                          }`}
                        >
                          {hasMedia ? (
                            <>
                              <img
                                src={post.image || post.images?.[0] || ""}
                                alt={post.text || "Post"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              {/* Overlay on hover */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-4 text-white">
                                  <div className="flex items-center gap-1">
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    <span className="font-semibold">{post.likeCount || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span className="font-semibold">{post.commentCount || 0}</span>
                                  </div>
                                </div>
                              </div>
                              {/* Multiple images indicator */}
                              {post.images && post.images.length > 1 && (
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {post.images.length}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col justify-between p-4">
                              <p className="text-sm text-[var(--text-primary)] line-clamp-4 leading-relaxed">
                                {post.text || "No content"}
                              </p>
                              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--card-border)] text-xs text-[var(--text-secondary)]">
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 fill-current text-[var(--color-accent)]" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                  <span>{post.likeCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  <span>{post.commentCount || 0}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="max-w-2xl mx-auto space-y-6">
                {profile.bio && (
                  <div className="pb-4 border-b border-[var(--card-border)]">
                    <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Bio
                    </div>
                    <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                      {profile.bio}
                    </div>
                  </div>
                )}
                {profile.program_of_study && (
                  <div className="pb-4 border-b border-[var(--card-border)]">
                    <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Program of Study
                    </div>
                    <div className="text-sm text-[var(--text-primary)]">{profile.program_of_study}</div>
                  </div>
                )}
                {profile.graduation_year && (
                  <div className="pb-4 border-b border-[var(--card-border)]">
                    <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Graduation Year
                    </div>
                    <div className="text-sm text-[var(--text-primary)]">{profile.graduation_year}</div>
                  </div>
                )}
                {!profile.bio && !profile.program_of_study && !profile.graduation_year && (
                  <div className="text-center py-12 text-sm text-[var(--text-secondary)]">
                    No additional information available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

