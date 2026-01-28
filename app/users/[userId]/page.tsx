"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import { Post } from "@/components/PostsCard";
import { consumeProfileRefreshFlag } from "@/utils/storage";

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
  postType?: string;
  eventId?: string;
};

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;
  const [profile, setProfile] = useState<any | null>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "reposted" | "about">("reposted");
  const [postFilter, setPostFilter] = useState<"all" | "media" | "text">("all");
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [repostedPosts, setRepostedPosts] = useState<PostItem[]>([]);
  const [loadingReposted, setLoadingReposted] = useState<boolean>(false);
  const [activityType, setActivityType] = useState<"liked" | "commented" | "reposted">("liked");
  const [activityPosts, setActivityPosts] = useState<PostItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState<boolean>(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<"pending" | "accepted" | "rejected" | null>(null);
  const [canViewContent, setCanViewContent] = useState<boolean>(false);

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
            .select("id, full_name, program_of_study, bio, avatar_url, graduation_year, student_type, role")
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

  // When returning from post/event edit or delete: force refetch (no cache)
  useEffect(() => {
    if (!profile?.id) return;
    if (!consumeProfileRefreshFlag()) return;
    setLoadedTabs(new Set());
    setUserPosts([]);
    setRepostedPosts([]);
  }, [profile?.id]);

  // Ensure activeTab is valid for user role
  useEffect(() => {
    if (!profile) return;
    const isAdmin = profile.role === "admin";
    if (!isAdmin && activeTab === "posts") {
      setActiveTab("reposted");
    }
  }, [profile, activeTab]);

  // Load user's posts when Posts tab is active
  useEffect(() => {
    if (activeTab !== "posts" || !profile?.id) return;
    
    // Only load if user can view content (own profile or connected)
    if (!isOwnProfile && !canViewContent) return;

    if (loadedTabs.has("posts")) return;

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
              post_type,
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
          setLoadedTabs(prev => new Set(prev).add("posts"));
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

        // Get event IDs for event posts
        const eventPostIds = (postsData ?? [])
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
              postType: row.post_type || "text",
              eventId: row.post_type === "event" ? eventIdMap[row.id] : undefined,
            };
          }) as PostItem[];

        if (mounted) {
          setUserPosts(mapped);
          setLoadedTabs(prev => new Set(prev).add("posts"));
        }
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
  }, [activeTab, profile?.id, profile?.full_name, profile?.graduation_year, profile?.avatar_url, loadedTabs, isOwnProfile, canViewContent]);

  // Load user's reposted posts when Reposted tab is active
  useEffect(() => {
    if (activeTab !== "reposted" || !profile?.id) return;
    
    // Only load if user can view content (own profile or connected)
    if (!isOwnProfile && !canViewContent) return;

    if (loadedTabs.has("reposted")) return;

    let mounted = true;

    const loadRepostedPosts = async () => {
      setLoadingReposted(true);

      try {
        // Get current user first (for checking if they've liked/reposted these posts)
        const [
          { data: { user: currentUser } },
          { data: repostsData, error: repostsErr }
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("reposts")
            .select("post_id, created_at")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(50)
        ]);

        if (repostsErr) {
          console.error("Error loading reposts:", repostsErr);
          if (!mounted) return;
          return;
        }

        if (!mounted) return;

        const postIds = (repostsData ?? []).map((r: any) => r.post_id);

        if (postIds.length === 0) {
          if (!mounted) return;
          setRepostedPosts([]);
          setLoadingReposted(false);
          setLoadedTabs(prev => new Set(prev).add("reposted"));
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
          .eq("is_deleted", false);

        if (postsErr) {
          console.error("Error loading reposted posts:", postsErr);
          if (!mounted) return;
          return;
        }

        if (!mounted) return;

        const currentUserId = currentUser?.id;
        const fetchedPostIds = (postsData ?? []).map((p: any) => p.id);

        // Execute all count queries in parallel
        const [
          { data: likesData },
          { data: userLikesData },
          { data: commentsData },
          { data: allRepostsData },
          { data: userRepostsData },
        ] = await Promise.all([
          // Get like counts
          supabase
            .from("post_likes")
            .select("post_id")
            .in("post_id", fetchedPostIds),
          // Get user's likes
          currentUserId
            ? supabase
                .from("post_likes")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", fetchedPostIds)
            : Promise.resolve({ data: null }),
          // Get comment counts
          supabase
            .from("comments")
            .select("post_id")
            .in("post_id", fetchedPostIds)
            .eq("is_deleted", false),
          // Get repost counts
          supabase
            .from("reposts")
            .select("post_id")
            .in("post_id", fetchedPostIds),
          // Get user's reposts
          currentUserId
            ? supabase
                .from("reposts")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", fetchedPostIds)
            : Promise.resolve({ data: null }),
        ]);

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
        (allRepostsData ?? []).forEach((repost: any) => {
          repostCountMap[repost.post_id] = (repostCountMap[repost.post_id] || 0) + 1;
        });

        // Get event IDs for event posts
        const eventPostIds = (postsData ?? [])
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

        // Create a map to maintain order from repostsData
        const repostOrderMap = new Map();
        (repostsData ?? []).forEach((r: any, index: number) => {
          repostOrderMap.set(r.post_id, index);
        });

        // Map posts with author info from joined profiles
        const mapped: PostItem[] = (postsData ?? [])
          .map((row: any) => {
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
              postType: row.post_type || "text",
              eventId: row.post_type === "event" ? eventIdMap[row.id] : undefined,
            };
          })
          .sort((a, b) => {
            // Sort by repost order (most recent repost first)
            const orderA = repostOrderMap.get(a.id) ?? Infinity;
            const orderB = repostOrderMap.get(b.id) ?? Infinity;
            return orderA - orderB;
          }) as PostItem[];

        if (mounted) {
          setRepostedPosts(mapped);
          setLoadedTabs(prev => new Set(prev).add("reposted"));
        }
      } catch (err) {
        console.error("Unexpected error loading reposted posts:", err);
      } finally {
        if (mounted) setLoadingReposted(false);
      }
    };

    loadRepostedPosts();

    return () => {
      mounted = false;
    };
  }, [activeTab, profile?.id, loadedTabs, isOwnProfile, canViewContent]);

  // Check follow status and load connections count when profile loads
  useEffect(() => {
    if (!profile?.id) return;

    let mounted = true;

    const checkFollowStatusAndConnections = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Check if current user is following this profile and get status
        // Also check bidirectional connection (if profile user is following current user)
        if (user) {
          const [userToProfile, profileToUser] = await Promise.all([
            supabase
              .from("follows")
              .select("id, status")
              .eq("follower_id", user.id)
              .eq("following_id", profile.id)
              .single(),
            supabase
              .from("follows")
              .select("id, status")
              .eq("follower_id", profile.id)
              .eq("following_id", user.id)
              .single()
          ]);

          const userToProfileData = userToProfile.data;
          const profileToUserData = profileToUser.data;
          const userToProfileError = userToProfile.error;
          const profileToUserError = profileToUser.error;

          // Check for connection in either direction
          if (userToProfileData) {
            if (mounted) {
              setIsFollowing(true);
              setConnectionStatus(userToProfileData.status as "pending" | "accepted" | "rejected");
              // Can view content if status is accepted (bidirectional)
              setCanViewContent(userToProfileData.status === "accepted");
            }
          } else if (profileToUserData && profileToUserData.status === "accepted") {
            // Profile user has accepted connection to current user (bidirectional)
            if (mounted) {
              setIsFollowing(false); // Current user hasn't sent request
              setConnectionStatus(null);
              setCanViewContent(true); // Can view because of bidirectional connection
            }
          } else {
            if (mounted) {
              setIsFollowing(false);
              setConnectionStatus(null);
              setCanViewContent(false);
            }
          }

          // Log errors only if they're not "not found" errors
          if (userToProfileError && userToProfileError.code !== "PGRST116") {
            console.error("Error checking follow status:", userToProfileError);
          }
          if (profileToUserError && profileToUserError.code !== "PGRST116") {
            console.error("Error checking bidirectional follow status:", profileToUserError);
          }
        } else {
          if (mounted) {
            setIsFollowing(false);
            setConnectionStatus(null);
            setCanViewContent(false);
          }
        }

        // Get connections count (number of people following this user with accepted status)
        const { count, error: countError } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", profile.id)
          .eq("status", "accepted");

        if (countError) {
          console.error("Error loading connections count:", countError);
        } else {
          if (mounted) setConnectionsCount(count ?? 0);
        }
      } catch (err) {
        console.error("Unexpected error checking follow status and connections:", err);
        if (mounted) {
          setIsFollowing(false);
          setConnectionStatus(null);
          setCanViewContent(false);
        }
      }
    };

    checkFollowStatusAndConnections();

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  // Handle connection request/unfollow toggle
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

      if (isFollowing && connectionStatus === "accepted") {
        // Unfollow: DELETE both directions (A→B and B→A if exists)
        const [deleteError, deleteBidirectionalError] = await Promise.all([
          supabase
            .from("follows")
            .delete()
            .eq("follower_id", user.id)
            .eq("following_id", profile.id),
          supabase
            .from("follows")
            .delete()
            .eq("follower_id", profile.id)
            .eq("following_id", user.id)
        ]);

        if (deleteError.error) {
          console.error("Error unfollowing user:", deleteError.error);
          return;
        }
        // Ignore error for bidirectional delete (might not exist)

        setIsFollowing(false);
        setConnectionStatus(null);
        setCanViewContent(false);
        // Update connections count optimistically
        setConnectionsCount((prev) => Math.max(0, prev - 1));
      } else if (!isFollowing || connectionStatus === "pending") {
        // Send connection request: INSERT with status 'pending'
        const { error } = await supabase
          .from("follows")
          .insert({ 
            follower_id: user.id, 
            following_id: profile.id,
            status: "pending"
          });

        if (error) {
          // Handle unique constraint violation (already has request)
          if (error.code === "23505") {
            // Update existing request to pending if it was rejected
            const { error: updateError } = await supabase
              .from("follows")
              .update({ status: "pending" })
              .eq("follower_id", user.id)
              .eq("following_id", profile.id);

            if (updateError) {
              console.error("Error updating connection request:", updateError);
              return;
            }
          } else {
            console.error("Error sending connection request:", error);
            return;
          }
        }

        // Create notification for the user being requested
        await supabase.from("notifications").insert({
          user_id: profile.id,
          type: "connection_request",
          actor_id: user.id,
          is_read: false,
        });

        setIsFollowing(true);
        setConnectionStatus("pending");
        setCanViewContent(false);
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
                      onError={(e) => {
                        // Fallback to placeholder on error
                        const target = e.target as HTMLImageElement;
                        target.src = "/images/avatar_placeholder.png";
                      }}
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
                      connectionStatus === "accepted"
                        ? "border border-[var(--card-border)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]"
                        : connectionStatus === "pending"
                        ? "border border-[var(--card-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] cursor-not-allowed"
                        : "bg-[var(--color-accent)] text-white hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)]"
                    } ${isTogglingFollow ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {isTogglingFollow 
                      ? "..." 
                      : connectionStatus === "accepted" 
                      ? "Connected" 
                      : connectionStatus === "pending"
                      ? "Request Sent"
                      : "Connect"}
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
              {profile.role === "admin" && (
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
              )}
              <button
                onClick={() => setActiveTab("reposted")}
                className={`flex-1 text-center py-4 border-b-2 transition-colors ${
                  activeTab === "reposted"
                    ? "text-[var(--text-primary)] border-[var(--color-accent)] font-semibold"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                }`}
              >
                Reposted
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
            {/* Private Account Message */}
            {!isOwnProfile && !canViewContent && (
              <div className="text-center py-12 px-4">
                <div className="max-w-md mx-auto">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    This profile is private
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-6">
                    Connect to see {profile.full_name || "this user"}'s posts, reposts, and activity
                  </p>
                  {connectionStatus !== "pending" && (
                    <button
                      onClick={handleToggleFollow}
                      disabled={isTogglingFollow}
                      className="px-6 py-2.5 rounded-lg bg-[var(--color-accent)] text-white font-semibold hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isTogglingFollow ? "..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === "posts" && (isOwnProfile || canViewContent) && (
              <div>
                {/* Post Filter Tabs */}
                <div className="flex gap-2 border-b border-[var(--card-border)] mb-6 -mx-6 px-6 pb-4 overflow-x-auto">
                  <button
                    onClick={() => setPostFilter("all")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      postFilter === "all"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPostFilter("media")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      postFilter === "media"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    Media
                  </button>
                  <button
                    onClick={() => setPostFilter("text")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      postFilter === "text"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    Text
                  </button>
                </div>

                {loadingPosts ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-[var(--text-secondary)]">Loading posts...</div>
                  </div>
                ) : (() => {
                  const filteredPosts = postFilter === "all" 
                    ? userPosts 
                    : postFilter === "media"
                    ? userPosts.filter(post => post.image || (post.images && post.images.length > 0))
                    : userPosts.filter(post => !post.image && (!post.images || post.images.length === 0));

                  if (filteredPosts.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">
                          {postFilter === "all" && "No posts yet."}
                          {postFilter === "media" && "No media posts yet."}
                          {postFilter === "text" && "No text posts yet."}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] opacity-70">
                          {postFilter === "all" && "This user hasn't shared anything yet."}
                          {postFilter === "media" && "This user hasn't shared any media posts yet."}
                          {postFilter === "text" && "This user hasn't shared any text posts yet."}
                        </div>
                      </div>
                    );
                  }

                  const hasMedia = filteredPosts.some(post => post.image || (post.images && post.images.length > 0));
                  const hasText = filteredPosts.some(post => !post.image && (!post.images || post.images.length === 0));

                  return (
                    <div className="space-y-6">
                      {/* Media Posts */}
                      {(postFilter === "all" || postFilter === "media") && hasMedia && (
                        <div>
                          {postFilter === "all" && (
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Media Posts</h3>
                          )}
                          <div className="grid grid-cols-3 gap-1 sm:gap-2 lg:gap-4">
                            {filteredPosts
                              .filter(post => post.image || (post.images && post.images.length > 0))
                              .map((post) => (
                                <div
                                  key={post.id}
                                  onClick={() => {
                                    router.push(`/posts/${post.id}`);
                                  }}
                                  className="cursor-pointer group relative overflow-hidden rounded sm:rounded-lg border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg aspect-square bg-gray-100 dark:bg-gray-800"
                                >
                                  <Image
                                    src={post.image || post.images?.[0] || ""}
                                    alt={post.text || "Post"}
                                    width={400}
                                    height={400}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    unoptimized
                                    onError={(e) => {
                                      // Hide broken images on error (e.g., timeout)
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                    }}
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
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Text Posts */}
                      {(postFilter === "all" || postFilter === "text") && hasText && (
                        <div>
                          {postFilter === "all" && (
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Text Posts</h3>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPosts
                              .filter(post => !post.image && (!post.images || post.images.length === 0))
                              .map((post) => (
                              <div
                                key={post.id}
                                onClick={() => {
                                  router.push(`/posts/${post.id}`);
                                }}
                                className="cursor-pointer group relative overflow-hidden rounded-lg border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg bg-[var(--card-bg)] min-h-[120px]"
                              >
                                  <div className="w-full h-full flex flex-col justify-between p-4">
                                    <p className="text-sm text-[var(--text-primary)] line-clamp-4 leading-relaxed">
                                      {post.text || "No content"}
                                    </p>
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--card-border)] text-xs text-[var(--text-secondary)]">
                                      <div className="flex items-center gap-1">
                                        {(post.likeCount || 0) > 0 ? (
                                          <svg className="w-4 h-4 fill-current text-[var(--color-accent)]" viewBox="0 0 24 24">
                                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                          </svg>
                                        )}
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
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "reposted" && (isOwnProfile || canViewContent) && (
              <div>
                {/* Post Filter Tabs */}
                <div className="flex gap-2 border-b border-[var(--card-border)] mb-6 -mx-6 px-6 pb-4 overflow-x-auto">
                  <button
                    onClick={() => setPostFilter("all")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      postFilter === "all"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPostFilter("media")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      postFilter === "media"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    Media
                  </button>
                  <button
                    onClick={() => setPostFilter("text")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      postFilter === "text"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    Text
                  </button>
                </div>

                {loadingReposted ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-[var(--text-secondary)]">Loading reposted posts...</div>
                  </div>
                ) : (() => {
                  const filteredPosts = postFilter === "all" 
                    ? repostedPosts 
                    : postFilter === "media"
                    ? repostedPosts.filter(post => post.image || (post.images && post.images.length > 0))
                    : repostedPosts.filter(post => !post.image && (!post.images || post.images.length === 0));

                  if (filteredPosts.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">
                          {postFilter === "all" && "No reposted posts yet."}
                          {postFilter === "media" && "No reposted media posts yet."}
                          {postFilter === "text" && "No reposted text posts yet."}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] opacity-70">
                          {postFilter === "all" && "This user hasn't reposted anything yet."}
                          {postFilter === "media" && "This user hasn't reposted any media posts yet."}
                          {postFilter === "text" && "This user hasn't reposted any text posts yet."}
                        </div>
                      </div>
                    );
                  }

                  const hasMedia = filteredPosts.some(post => post.image || (post.images && post.images.length > 0));
                  const hasText = filteredPosts.some(post => !post.image && (!post.images || post.images.length === 0));

                  return (
                    <div className="space-y-6">
                      {/* Media Posts */}
                      {(postFilter === "all" || postFilter === "media") && hasMedia && (
                        <div>
                          {postFilter === "all" && (
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Media Posts</h3>
                          )}
                          <div className="grid grid-cols-3 gap-1 sm:gap-2 lg:gap-4">
                            {filteredPosts
                              .filter(post => post.image || (post.images && post.images.length > 0))
                              .map((post) => (
                                <div
                                  key={post.id}
                                  onClick={() => {
                                    router.push(`/posts/${post.id}`);
                                  }}
                                  className="cursor-pointer group relative overflow-hidden rounded sm:rounded-lg border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg aspect-square bg-gray-100 dark:bg-gray-800"
                                >
                                  <Image
                                    src={post.image || post.images?.[0] || ""}
                                    alt={post.text || "Post"}
                                    width={400}
                                    height={400}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    unoptimized
                                    onError={(e) => {
                                      // Hide broken images on error (e.g., timeout)
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                    }}
                                  />
                                  {/* Repost badge */}
                                  <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-500/90 text-white">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
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
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Text Posts */}
                      {(postFilter === "all" || postFilter === "text") && hasText && (
                        <div>
                          {postFilter === "all" && (
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Text Posts</h3>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPosts
                              .filter(post => !post.image && (!post.images || post.images.length === 0))
                              .map((post) => (
                              <div
                                key={post.id}
                                onClick={() => {
                                  router.push(`/posts/${post.id}`);
                                }}
                                className="cursor-pointer group relative overflow-hidden rounded-lg border border-[var(--card-border)] hover:border-[var(--color-accent)] transition-all hover:shadow-lg bg-[var(--card-bg)] min-h-[120px]"
                              >
                                <div className="w-full h-full flex flex-col justify-between p-4 relative">
                                  {/* Repost badge */}
                                  <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-500/90 text-white">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </div>
                                  <p className="text-sm text-[var(--text-primary)] line-clamp-4 leading-relaxed pt-8">
                                    {post.text || "No content"}
                                  </p>
                                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--card-border)] text-xs text-[var(--text-secondary)]">
                                    <div className="flex items-center gap-1">
                                      {(post.likeCount || 0) > 0 ? (
                                        <svg className="w-4 h-4 fill-current text-[var(--color-accent)]" viewBox="0 0 24 24">
                                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                        </svg>
                                      )}
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
                              </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "about" && (isOwnProfile || canViewContent) && (
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

