"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import { Post } from "@/components/PostsCard";

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
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // Parallelize auth check and profile fetch
        const [
          { data: { user: currentUser } },
          { data: profileData, error: profileError }
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("profiles")
            .select("id, full_name, program_of_study, bio, avatar_url, graduation_year, student_type")
            .eq("id", userId)
            .single()
        ]);

        if (currentUser?.id === userId) {
          if (!mounted) return;
          setIsOwnProfile(true);
          router.push("/profile");
          return;
        }

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
        // Get current user first (can be done in parallel with posts fetch)
        const [
          { data: { user } },
          { data: postsData, error: postsErr }
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("posts")
            .select(
              `
              id,
              body,
              created_at,
              author_id,
              post_media (
                url,
                order_index
              )
            `
            )
            .eq("author_id", profile.id)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(50) // Limit initial load for better performance
        ]);

        if (postsErr) {
          console.error("Error loading user posts:", postsErr);
          if (!mounted) return;
          return;
        }

        if (!mounted) return;

        const postIds = (postsData ?? []).map((p: any) => p.id);

        if (postIds.length === 0) {
          if (!mounted) return;
          setUserPosts([]);
          setLoadingPosts(false);
          return;
        }

        const currentUserId = user?.id;

        // Execute all count queries in parallel - only fetch post_id for minimal data transfer
        const [
          { data: likesData },
          { data: userLikesData },
          { data: commentsData },
          { data: repostsData },
          { data: userRepostsData },
        ] = await Promise.all([
          // Get like counts - only fetch post_id for counting
          supabase
            .from("post_likes")
            .select("post_id")
            .in("post_id", postIds),
          // Get user's likes
          currentUserId
            ? supabase
                .from("post_likes")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", postIds)
            : Promise.resolve({ data: null }),
          // Get comment counts - only fetch post_id
          supabase
            .from("comments")
            .select("post_id")
            .in("post_id", postIds)
            .eq("is_deleted", false),
          // Get repost counts - only fetch post_id
          supabase
            .from("reposts")
            .select("post_id")
            .in("post_id", postIds),
          // Get user's reposts
          currentUserId
            ? supabase
                .from("reposts")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", postIds)
            : Promise.resolve({ data: null }),
        ]);

        // Create maps for quick lookup - optimized counting
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

        // Map posts - use profile data we already have instead of joined profile
        const mapped: PostItem[] =
          (postsData ?? []).map((row: any) => {
            const media = (row.post_media as any[]) ?? [];
            const sortedMedia = media
              .slice()
              .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            const allImages = sortedMedia.map((m: any) => m.url).filter(Boolean);
            const firstMedia = sortedMedia[0] ?? null;

            return {
              id: row.id,
              name: profile.full_name ?? "Unknown",
              text: row.body ?? "",
              created_at: row.created_at,
              gradYear:
                profile.graduation_year != null
                  ? String(profile.graduation_year).slice(-2)
                  : "",
              image: firstMedia?.url ?? "",
              images: allImages.length > 0 ? allImages : undefined,
              avatar: profile.avatar_url ?? undefined,
              authorId: row.author_id,
              likeCount: likeCountMap[row.id] || 0,
              isLiked: userLikedSet.has(row.id),
              commentCount: commentCountMap[row.id] || 0,
              repostCount: repostCountMap[row.id] || 0,
              isReposted: userRepostedSet.has(row.id),
            };
          }) as PostItem[];

        if (mounted) setUserPosts(mapped);
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
  }, [activeTab, profile?.id, profile?.full_name, profile?.graduation_year, profile?.avatar_url]);

  // Check follow status and load connections count when profile loads
  useEffect(() => {
    if (!profile?.id) return;

    let mounted = true;

    const checkFollowStatusAndConnections = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Check if current user is following this profile
        if (user) {
          const { data, error } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", profile.id)
            .single();

          if (error && error.code !== "PGRST116") {
            // PGRST116 is "not found" which is fine
            console.error("Error checking follow status:", error);
            if (mounted) setIsFollowing(false);
          } else {
            if (mounted) setIsFollowing(!!data);
          }
        } else {
          if (mounted) setIsFollowing(false);
        }

        // Get connections count (number of people following this user)
        const { count, error: countError } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", profile.id);

        if (countError) {
          console.error("Error loading connections count:", countError);
        } else {
          if (mounted) setConnectionsCount(count ?? 0);
        }
      } catch (err) {
        console.error("Unexpected error checking follow status and connections:", err);
        if (mounted) setIsFollowing(false);
      }
    };

    checkFollowStatusAndConnections();

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  // Handle follow/unfollow toggle
  const handleToggleFollow = async () => {
    if (!profile?.id || isTogglingFollow) return;

    try {
      setIsTogglingFollow(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Not authenticated");
        router.push("/signin");
        return;
      }

      if (isFollowing) {
        // Unfollow: DELETE
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);

        if (error) {
          console.error("Error unfollowing user:", error);
          return;
        }

        setIsFollowing(false);
        // Update connections count optimistically
        setConnectionsCount((prev) => Math.max(0, prev - 1));
      } else {
        // Follow: INSERT
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: profile.id });

        if (error) {
          // Handle unique constraint violation (already following)
          if (error.code === "23505") {
            setIsFollowing(true);
          } else {
            console.error("Error following user:", error);
          }
          return;
        }

        setIsFollowing(true);
        // Update connections count optimistically
        setConnectionsCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Unexpected error toggling follow:", err);
    } finally {
      setIsTogglingFollow(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="text-lg text-[var(--text-secondary)]">Loading profile…</div>
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
    <div className="bg-[var(--bg-primary)] min-h-screen py-6 sm:py-10 flex flex-col items-start sm:items-center px-4 sm:px-6 transition-colors">
      <div className="w-full max-w-6xl">
        {/* Profile Header - Well Designed */}
        <div className="mb-8">
          {/* Profile Card */}
          <div className="rounded-2xl shadow-sm p-6 sm:p-8 transition-colors">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start">
              {/* Avatar Section */}
              <div className="flex-shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[var(--bg-primary)] overflow-hidden flex-shrink-0 border-3 border-[var(--card-border)] shadow-md ring-2 ring-[var(--card-border)] relative">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.full_name || "Profile"}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)] text-4xl font-semibold">
                      {profile.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 min-w-0 w-full">
                {/* Name + Grad Year + Student Type */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3 items-center sm:items-start">
                  <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                    <h2 className="font-bold text-2xl sm:text-3xl text-[var(--text-primary)]">
                      {profile.full_name || "Unknown User"}
                    </h2>
                    {profile.graduation_year && (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] dark:bg-slate-800 px-3 py-1 rounded-full border border-[var(--card-border)]">
                        <img
                          src="/svgs/graduate.svg"
                          alt="Graduate"
                          className="h-3.5 w-3.5 svg-icon"
                        />
                        {String(profile.graduation_year).slice(-2)}
                      </span>
                    )}
                    {profile.student_type && (
                      <span className="text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] dark:bg-slate-800 px-3 py-1 rounded-full border border-[var(--card-border)]">
                        {profile.student_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Program of Study */}
                {profile.program_of_study && (
                  <div className="text-base text-[var(--text-secondary)] mb-3 font-medium text-center sm:text-left">
                    {profile.program_of_study}
                  </div>
                )}

                {/* Connections Count */}
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-4 text-center sm:text-left">
                  {connectionsCount} campus {connectionsCount === 1 ? 'connection' : 'connections'}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed whitespace-pre-line mb-6 max-w-2xl text-center sm:text-left">
                    {profile.bio}
                  </div>
                )}

                {/* Connect Button */}
                <div className="flex justify-center sm:justify-start mt-6">
                  <button
                    onClick={handleToggleFollow}
                    disabled={isTogglingFollow}
                    className={`px-5 py-2.5 rounded-lg font-semibold transition shadow-sm text-sm sm:text-base ${
                      isFollowing
                        ? "border border-[var(--card-border)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]"
                        : "bg-[var(--color-accent)] text-white hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)]"
                    } ${isTogglingFollow ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {isTogglingFollow ? "..." : isFollowing ? "Connected" : "Connect"}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
          <div className="p-0 sm:p-6">
            {activeTab === "posts" && (
              <div>
                {loadingPosts ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-[var(--text-secondary)]">Loading posts...</div>
                  </div>
                ) : userPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-[var(--text-secondary)] mb-2">
                      No posts yet.
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] opacity-70">
                      This user hasn't shared anything yet.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 sm:gap-2 lg:gap-4">
                    {userPosts.map((post) => {
                      const hasMedia = post.image || (post.images && post.images.length > 0);
                      return (
                        <div
                          key={post.id}
                          onClick={() => router.push(`/posts/${post.id}`)}
                          className={`cursor-pointer group relative overflow-hidden rounded sm:rounded-lg border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg ${
                            hasMedia 
                              ? "aspect-square bg-gray-100 dark:bg-gray-800" 
                              : "bg-[var(--card-bg)] min-h-[120px] max-h-[200px]"
                          }`}
                        >
                          {hasMedia ? (
                            <>
                              <Image
                                src={post.image || post.images?.[0] || ""}
                                alt={post.text || "Post"}
                                width={400}
                                height={400}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                unoptimized
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

