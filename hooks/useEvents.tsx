"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "./useProfile";

export type EventItem = {
  id: string;
  post_id: string;
  title: string;
  datetime: string;
  location: string;
  imageSrc?: string;
  organizer?: string;
  attendees?: number;
  description?: string;
  starts_at: string;
  ends_at?: string;
  location_name?: string;
  location_address?: string;
  external_url?: string;
  event_type?: string[] | null;
  audience?: string[] | null;
  logistics?: string[] | null;
  special_interests?: string[] | null;
  time_based?: string[] | null;
};

const EVENTS_PER_PAGE = 20;

async function fetchEventsPage(
  page: number,
  userId: string,
  universityId: string | null
): Promise<{ events: EventItem[]; attendeeCounts: Record<string, number>; joinedMap: Record<string, boolean>; hasMore: boolean; totalCount: number | null }> {
  const from = page * EVENTS_PER_PAGE;
  const to = from + EVENTS_PER_PAGE - 1;

  // When filtering by university, use a two-query approach to avoid PostgREST 500 errors
  // from filtering on nested resources (events -> posts.university_id).
  let universityPostIds: string[] | null = null;
  if (universityId) {
    const { data: postRows, error: postsErr } = await supabase
      .from("posts")
      .select("id")
      .eq("university_id", universityId);

    if (postsErr) {
      console.error("Events: failed to fetch university post IDs", postsErr);
      throw new Error(`Error loading events: ${postsErr.message}`);
    }
    universityPostIds = (postRows ?? []).map((r: { id: string }) => r.id);
    if (universityPostIds.length === 0) {
      return {
        events: [],
        attendeeCounts: {},
        joinedMap: {},
        hasMore: false,
        totalCount: 0,
      };
    }
  }

  let query = supabase
    .from("events")
    .select(
      `
        id,
        post_id,
        starts_at,
        ends_at,
        location_name,
        location_address,
        external_url,
        event_type,
        audience,
        logistics,
        special_interests,
        time_based,
        posts!inner (
          id,
          title,
          body,
          created_at,
          university_id,
          profiles!inner (
            id,
            full_name,
            role
          ),
          post_media (
            url,
            order_index
          )
        )
      `,
      { count: "exact" }
    )
    .order("starts_at", { ascending: true })
    .range(from, to);

  if (universityPostIds && universityPostIds.length > 0) {
    query = query.in("post_id", universityPostIds);
  }

  const { data: eventsData, error: eventsError, count } = await query;

  if (eventsError) {
    console.error("Events: Supabase error", eventsError);
    throw new Error(`Error loading events: ${eventsError.message}`);
  }

  if (!eventsData || eventsData.length === 0) {
    return {
      events: [],
      attendeeCounts: {},
      joinedMap: {},
      hasMore: false,
      totalCount: count,
    };
  }

  // Get all event IDs
  const eventIds = eventsData.map((row: any) => row.id);

  // Get attendee counts and user's attendee status in parallel
  const [
    { data: attendeeCountsData },
    { data: userAttendeesData },
  ] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("event_id")
      .in("event_id", eventIds),
    supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", userId)
      .in("event_id", eventIds),
  ]);

  // Count attendees per event
  const countsMap: Record<string, number> = {};
  (attendeeCountsData ?? []).forEach((row: any) => {
    countsMap[row.event_id] = (countsMap[row.event_id] || 0) + 1;
  });

  // Map user's attendance status
  const userJoinedSet = new Set(
    (userAttendeesData ?? []).map((row: any) => row.event_id)
  );

  const joinedStatus: Record<string, boolean> = {};
  eventIds.forEach((eventId: string) => {
    joinedStatus[eventId] = userJoinedSet.has(eventId);
  });

  // Map events data
  const mapped: EventItem[] = eventsData
    .map((row: any) => {
      const post = row.posts as any;
      const author = post?.profiles as any;
      const media = (post?.post_media as any[]) ?? [];
      const firstMedia =
        media
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0] ??
        null;

      const startDate = new Date(row.starts_at);
      const formattedDate = startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      return {
        id: row.id,
        post_id: row.post_id,
        title: post?.title || "Untitled Event",
        description: post?.body || "",
        datetime: formattedDate,
        location: row.location_name || row.location_address || "Location TBD",
        imageSrc: firstMedia?.url,
        organizer: author?.full_name || "Unknown",
        attendees: countsMap[row.id] || 0,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        location_name: row.location_name,
        location_address: row.location_address,
        external_url: row.external_url,
        event_type: row.event_type,
        audience: row.audience,
        logistics: row.logistics,
        special_interests: row.special_interests,
        time_based: row.time_based,
      };
    })
    .filter((e: EventItem | null) => e !== null) as EventItem[];

  const totalLoaded = (page + 1) * EVENTS_PER_PAGE;
  const hasMore = count !== null ? totalLoaded < count : mapped.length === EVENTS_PER_PAGE;

  return {
    events: mapped,
    attendeeCounts: countsMap,
    joinedMap: joinedStatus,
    hasMore,
    totalCount: count,
  };
}

export function useEvents() {
  const { data: profile, isLoading: profileLoading } = useProfile();

  return useInfiniteQuery({
    queryKey: ["events", profile?.university_id],
    queryFn: async ({ pageParam = 0 }) => {
      // Get current authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      return fetchEventsPage(pageParam, user.id, profile?.university_id || null);
    },
    enabled: !!profile && !profileLoading,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - keep data fresh longer
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnMount: false, // Don't refetch when component remounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Only refetch on reconnect
    retry: (failureCount, error: any) => {
      if (error?.message === "Not authenticated") {
        return false;
      }
      return failureCount < 3;
    },
  });
}

