"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
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
  likeCount?: number;
  isLiked?: boolean;
  commentCount?: number;
};

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"posts" | "activity" | "about">("posts");
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);

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

        // Create maps for quick lookup
        const likeCountMap: Record<string, number> = {};
        const commentCountMap: Record<string, number> = {};
        const userLikedSet = new Set(
          (userLikesData ?? []).map((like: any) => like.post_id)
        );

        // Count likes per post
        (likesData ?? []).forEach((like: any) => {
          likeCountMap[like.post_id] = (likeCountMap[like.post_id] || 0) + 1;
        });

        // Count comments per post
        (commentsData ?? []).forEach((comment: any) => {
          commentCountMap[comment.post_id] = (commentCountMap[comment.post_id] || 0) + 1;
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
              likeCount: likeCountMap[row.id] || 0,
              isLiked: userLikedSet.has(row.id),
              commentCount: commentCountMap[row.id] || 0,
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
          <h2 className="text-2xl font-semibold mb-4 text-black">My Profile</h2>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          {!authChecked && (
            <div className="mb-4 text-sm text-slate-600">Checking authentication…</div>
          )}

          {authChecked && !profile && (
            <>
              <div className="mb-6 text-sm text-slate-600">
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
                  className="px-4 py-2 border border-slate-300 rounded-md hover:bg-gray-50 transition"
                >
                  Create profile
                </button>
              </div>
            </>
          )}

          {!authChecked && (
            <div className="mt-4 text-sm text-slate-500">
              If you expected to be signed in, check your session or open dev tools.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal authenticated + profile present render
  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex justify-center px-4 transition-colors">
      <div className="w-full max-w-2xl">
        {/* Profile Header Card */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] mb-6 overflow-hidden transition-colors">
          {/* Header Section */}
          <div className="px-6 py-5 border-b border-[var(--card-border)]">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">My Profile</h1>
          </div>

          {/* Profile Info Section */}
          <div className="px-6 py-6">
            {/* Avatar + Name */}
            <div className="flex gap-4 mb-4">
              <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || "Profile"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-2xl">
                    {profile.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
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

                {profile.program_of_study && (
                  <div className="text-sm text-[var(--text-secondary)] mt-1">
                    {profile.program_of_study}
                  </div>
                )}

                <div className="text-sm font-medium text-[var(--text-secondary)] mt-2">
                  {connectionsCount} campus connections
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="mt-4 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                {profile.bio}
              </div>
            )}

            {/* Role Tag */}
            {profile.org_role && (
              <div className="mt-4 inline-flex px-3 py-1.5 rounded-full bg-[var(--color-accent)]">
                <span className="text-xs font-medium text-white">
                  {profile.org_role}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push("/profileEditor")}
                className="flex-1 h-11 rounded-lg bg-[var(--color-accent)] text-white font-semibold hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition shadow-sm"
              >
                Edit Profile
              </button>
              <button
                onClick={() => router.push("/settings")}
                className="flex-1 h-11 rounded-lg border border-slate-300 font-semibold hover:bg-gray-50 transition text-black"
              >
                Settings
              </button>
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
          <div className="p-6">
            {activeTab === "posts" && (
              <div className="space-y-6">
                {loadingPosts ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-slate-500">Loading posts...</div>
                  </div>
                ) : userPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-slate-500 mb-2">
                      No posts yet.
                    </div>
                    <div className="text-xs text-slate-400">
                      Start sharing your campus experience!
                    </div>
                  </div>
                ) : (
                  userPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => router.push(`/posts/${post.id}`)}
                      className="cursor-pointer"
                    >
                      <Post
                        id={post.id}
                        name={post.name}
                        gradYear={post.gradYear}
                        avatar={post.avatar}
                        text={post.text}
                        created_at={post.created_at}
                        image={post.image}
                        images={post.images}
                        likeCount={post.likeCount}
                        isLiked={post.isLiked}
                        commentCount={post.commentCount}
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="text-center py-12">
                <div className="text-sm text-slate-500">Activity coming soon</div>
              </div>
            )}

            {activeTab === "about" && (
              <div className="space-y-4">
                {profile.program_of_study && (
                  <div className="pb-3 border-b border-neutral-100">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Program of Study
                    </div>
                    <div className="text-sm text-slate-900">{profile.program_of_study}</div>
                  </div>
                )}
                {profile.graduation_year && (
                  <div className="pb-3 border-b border-neutral-100">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Graduation Year
                    </div>
                    <div className="text-sm text-slate-900">{profile.graduation_year}</div>
                  </div>
                )}
                {!profile.program_of_study && !profile.graduation_year && (
                  <div className="text-center py-8 text-sm text-slate-500">
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
