"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
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

function MyProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<any | null>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"posts" | "activity" | "about">("posts");
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [activityType, setActivityType] = useState<"liked" | "commented" | "reposted" | "saves">("liked");
  const [activityPosts, setActivityPosts] = useState<PostItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);

  // Check URL parameters on mount to set tab and activity type
  useEffect(() => {
    const tab = searchParams.get("tab");
    const type = searchParams.get("type");
    
    if (tab === "activity") {
      setActiveTab("activity");
      if (type === "saves") {
        setActivityType("saves");
      } else if (type === "liked") {
        setActivityType("liked");
      } else if (type === "commented") {
        setActivityType("commented");
      } else if (type === "reposted") {
        setActivityType("reposted");
      }
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1️⃣ Get logged-in user
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr) {
          console.error("Auth getUser error:", authErr);
          if (!mounted) return;
          setErrorMsg("Error checking authentication.");
          setAuthChecked(true);
          return;
        }

        if (!user) {
          // For debugging it's nicer to show a sign-in CTA instead of forcing a router.push.
          // If you prefer immediate redirect, uncomment the next line:
          // router.push("/sign-in");
          if (!mounted) return;
          setAuthChecked(true);
          setLoading(false);
          setProfile(null);
          return;
        }

        const userId = user.id;
        console.log(user)

        // 2️⃣ Fetch user profile (check error)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, program_of_study, bio, avatar_url, graduation_year"
          )
          .eq("id", userId)
          .single();

        if (profileError) {
          console.warn("Profile fetch error or not found:", profileError);
          // It's okay if no profile yet — show 'Profile not found' UI
          if (!mounted) return;
          setProfile(null);
        } else {
          if (!mounted) return;
          setProfile(profileData ?? null);
        }

      

        if (mounted) setAuthChecked(true);
      } catch (err) {
        console.error("Unexpected load error:", err);
        if (mounted) setErrorMsg("Unexpected error loading profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  // Load activity posts when Activity tab is active
  useEffect(() => {
    if (activeTab !== "activity" || !profile?.id) return;

    let mounted = true;

    const loadActivityPosts = async () => {
      setLoadingActivity(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let postIds: string[] = [];

        if (activityType === "liked") {
          // Get posts the user liked
          const { data: likesData } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          postIds = (likesData ?? []).map((like: any) => like.post_id);
        } else if (activityType === "commented") {
          // Get posts the user commented on
          const { data: commentsData } = await supabase
            .from("comments")
            .select("post_id")
            .eq("author_id", user.id)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false });
          
          // Get unique post IDs
          const uniquePostIds = new Set((commentsData ?? []).map((c: any) => c.post_id));
          postIds = Array.from(uniquePostIds).slice(0, 50);
        } else if (activityType === "reposted") {
          // Get posts the user reposted
          const { data: repostsData } = await supabase
            .from("reposts")
            .select("post_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          postIds = (repostsData ?? []).map((repost: any) => repost.post_id);
        } else if (activityType === "saves") {
          // Get posts the user bookmarked
          const { data: bookmarksData } = await supabase
            .from("bookmarks")
            .select("post_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          postIds = (bookmarksData ?? []).map((bookmark: any) => bookmark.post_id);
        }

        if (postIds.length === 0) {
          if (!mounted) return;
          setActivityPosts([]);
          setLoadingActivity(false);
          return;
        }

        // Fetch the actual posts
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
          .in("id", postIds)
          .eq("is_deleted", false);

        if (postsErr) {
          console.error("Error loading activity posts:", postsErr);
          if (!mounted) return;
          setLoadingActivity(false);
          return;
        }

        if (!mounted) return;

        // Get like counts, comment counts, repost counts, and user's interaction status
        const fetchedPostIds = (postsData ?? []).map((p: any) => p.id);

        const { data: likesData } = await supabase
          .from("post_likes")
          .select("post_id, user_id")
          .in("post_id", fetchedPostIds);

        const { data: commentsData } = await supabase
          .from("comments")
          .select("post_id")
          .in("post_id", fetchedPostIds)
          .eq("is_deleted", false);

        const { data: repostsData } = await supabase
          .from("reposts")
          .select("post_id, user_id")
          .in("post_id", fetchedPostIds);

        // Create maps for quick lookup
        const likeCountMap: Record<string, number> = {};
        const commentCountMap: Record<string, number> = {};
        const repostCountMap: Record<string, number> = {};
        const userLikedSet = new Set<string>();
        const userRepostedSet = new Set<string>();

        (likesData ?? []).forEach((like: any) => {
          likeCountMap[like.post_id] = (likeCountMap[like.post_id] || 0) + 1;
          if (like.user_id === user.id) {
            userLikedSet.add(like.post_id);
          }
        });

        (commentsData ?? []).forEach((comment: any) => {
          commentCountMap[comment.post_id] = (commentCountMap[comment.post_id] || 0) + 1;
        });

        (repostsData ?? []).forEach((repost: any) => {
          repostCountMap[repost.post_id] = (repostCountMap[repost.post_id] || 0) + 1;
          if (repost.user_id === user.id) {
            userRepostedSet.add(repost.post_id);
          }
        });

        // Maintain original order from postIds
        const postMap = new Map();
        (postsData ?? []).forEach((row: any) => {
          const author = row.profiles as any | null;
          const media = (row.post_media as any[]) ?? [];
          const sortedMedia = media
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
          const allImages = sortedMedia.map((m: any) => m.url).filter(Boolean);
          const firstMedia = sortedMedia[0] ?? null;

          postMap.set(row.id, {
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
          });
        });

        // Sort by original order
        const mapped = postIds
          .map((id) => postMap.get(id))
          .filter(Boolean) as PostItem[];

        setActivityPosts(mapped);
      } catch (err) {
        console.error("Unexpected error loading activity posts:", err);
      } finally {
        if (mounted) setLoadingActivity(false);
      }
    };

    loadActivityPosts();

    return () => {
      mounted = false;
    };
  }, [activeTab, activityType, profile?.id]);

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
        const userId = user?.id;

        // Get like counts for all posts
        const { data: likesData } = await supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", postIds);

        // Get user's likes
        const { data: userLikesData } = userId
          ? await supabase
              .from("post_likes")
              .select("post_id")
              .eq("user_id", userId)
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
        const { data: userRepostsData } = userId
          ? await supabase
              .from("reposts")
              .select("post_id")
              .eq("user_id", userId)
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

  // quick debug UI to inspect state if something's failing
  if (loading) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="text-lg text-[var(--text-secondary)]">Loading profile…</div>
        </div>
      </div>
    );
  }

  // not authenticated flow (shows sign-in button)
  if (!authChecked || !profile) {
    // if authChecked true but profile null => show "profile not found" variant
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen flex justify-center items-start px-4 py-10 transition-colors">
        <div className="w-full max-w-2xl bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] overflow-hidden p-8 transition-colors">
          <h2 className="text-2xl font-semibold mb-4 text-[var(--text-primary)]">My Profile</h2>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          {!authChecked && (
            <div className="mb-4 text-sm text-[var(--text-secondary)]">Checking authentication…</div>
          )}

          {authChecked && !profile && (
            <>
              <div className="mb-6 text-sm text-[var(--text-secondary)]">
                No profile found for the signed-in user.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/signin")}
                  className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
                >
                  Sign in
                </button>
                <button
                  onClick={() => router.push("/profileEditor")}
                  className="px-4 py-2 border border-[var(--card-border)] rounded-md hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-primary)]"
                >
                  Create profile
                </button>
              </div>
            </>
          )}

          {!authChecked && (
            <div className="mt-4 text-sm text-[var(--text-secondary)]">
              If you expected to be signed in, check your session or open dev tools.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal authenticated + profile present render
  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center px-4 transition-colors">
      <div className="w-full max-w-6xl">
        {/* Profile Header - Well Designed */}
        <div className="mb-8">
          {/* Title */}
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Profile</h1>

          {/* Profile Card */}
          <div className=" rounded-2xl shadow-sm p-6 sm:p-8 transition-colors">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              {/* Avatar Section */}
              <div className="flex-shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[var(--bg-primary)] overflow-hidden flex-shrink-0 border-3 border-[var(--card-border)] shadow-md ring-2 ring-[var(--card-border)]">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)] text-4xl font-semibold">
                      {profile.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 min-w-0">
                {/* Name + Grad Year + Role */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
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
                  </div>
                  {profile.org_role && (
                    <div className="inline-flex px-3 py-1.5 rounded-full bg-[var(--color-accent)]">
                      <span className="text-xs font-semibold text-white">
                        {profile.org_role}
                      </span>
                    </div>
                  )}
                </div>

                {/* Program of Study */}
                {profile.program_of_study && (
                  <div className="text-base text-[var(--text-secondary)] mb-3 font-medium">
                    {profile.program_of_study}
                  </div>
                )}

                {/* Connections Count */}
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                  {connectionsCount} campus {connectionsCount === 1 ? 'connection' : 'connections'}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed whitespace-pre-line mb-6 max-w-2xl">
                    {profile.bio}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    onClick={() => router.push("/profileEditor")}
                    className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-white font-semibold hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition shadow-sm text-sm sm:text-base"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => router.push("/settings")}
                    className="px-5 py-2.5 rounded-lg border border-[var(--card-border)] font-semibold hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-primary)] text-sm sm:text-base"
                  >
                    Settings
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
                onClick={() => setActiveTab("activity")}
                className={`flex-1 text-center py-4 border-b-2 transition-colors ${
                  activeTab === "activity"
                    ? "text-[var(--text-primary)] border-[var(--color-accent)] font-semibold"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                }`}
              >
                Activity
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
                      Start sharing your campus experience!
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-0.5 sm:gap-2 lg:gap-4">
                    {userPosts.map((post) => {
                      const hasMedia = post.image || (post.images && post.images.length > 0);
                      return (
                        <div
                          key={post.id}
                          onClick={() => router.push(`/posts/${post.id}`)}
                          className={`cursor-pointer group relative overflow-hidden sm:rounded-lg border-0 sm:border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg ${
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

            {activeTab === "activity" && (
              <div className="space-y-6">
                {/* Activity Type Selector */}
                <div className="flex gap-2 border-b border-[var(--card-border)] -mx-6 px-6 pb-4 overflow-x-auto">
                  <button
                    onClick={() => setActivityType("liked")}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activityType === "liked"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill={activityType === "liked" ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    Liked
                  </button>
                  <button
                    onClick={() => setActivityType("commented")}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activityType === "commented"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
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
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    Commented
                  </button>
                  <button
                    onClick={() => setActivityType("reposted")}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activityType === "reposted"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Reposted
                  </button>
                  <button
                    onClick={() => setActivityType("saves")}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activityType === "saves"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill={activityType === "saves" ? "currentColor" : "none"}
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
                    Saves
                  </button>
                </div>

                {/* Activity Posts */}
                {loadingActivity ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-[var(--text-secondary)]">Loading activity...</div>
                  </div>
                ) : activityPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-[var(--text-secondary)] mb-2">
                      {activityType === "liked" && "No liked posts yet"}
                      {activityType === "commented" && "No comments yet"}
                      {activityType === "reposted" && "No reposts yet"}
                      {activityType === "saves" && "No saved posts yet"}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] opacity-70">
                      {activityType === "liked" && "Start liking posts to see them here"}
                      {activityType === "commented" && "Start commenting on posts to see them here"}
                      {activityType === "reposted" && "Start reposting to see them here"}
                      {activityType === "saves" && "Start saving posts to see them here"}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-0.5 sm:gap-2 lg:gap-4">
                    {activityPosts.map((post) => {
                      const hasMedia = post.image || (post.images && post.images.length > 0);
                      return (
                        <div
                          key={post.id}
                          onClick={() => router.push(`/posts/${post.id}`)}
                          className={`cursor-pointer group relative overflow-hidden sm:rounded-lg border-0 sm:border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg ${
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
                              {/* Activity Badge */}
                              <div className={`absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                activityType === "liked" ? "bg-red-500/90 text-white" :
                                activityType === "commented" ? "bg-blue-500/90 text-white" :
                                activityType === "reposted" ? "bg-green-500/90 text-white" :
                                "bg-purple-500/90 text-white"
                              }`}>
                                {activityType === "liked" && (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                )}
                                {activityType === "commented" && (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                )}
                                {activityType === "reposted" && (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                                {activityType === "saves" && (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                  </svg>
                                )}
                              </div>
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
                            <div className="w-full h-full flex flex-col justify-between p-4 relative">
                              {/* Activity Badge */}
                              <div className={`absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                activityType === "liked" ? "bg-red-500/90 text-white" :
                                activityType === "commented" ? "bg-blue-500/90 text-white" :
                                activityType === "reposted" ? "bg-green-500/90 text-white" :
                                "bg-purple-500/90 text-white"
                              }`}>
                                {activityType === "liked" && (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                )}
                                {activityType === "commented" && (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                )}
                                {activityType === "reposted" && (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                                {activityType === "saves" && (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                  </svg>
                                )}
                              </div>
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

export default function MyProfilePage() {
  return (
    <Suspense fallback={
      <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="text-lg text-[var(--text-secondary)]">Loading profile…</div>
        </div>
      </div>
    }>
      <MyProfilePageContent />
    </Suspense>
  );
}
