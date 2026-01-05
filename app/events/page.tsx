// app/events/EventsClient.tsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import CreateEventModal from "@/components/CreateEventModal";
import EventsCard from "@/components/EventsCard";
import EventsCalendar from "@/components/EventsCalendar";
import { useEvents, EventItem } from "@/hooks/useEvents";
import { useProfile } from "@/hooks/useProfile";
import { invalidateEvents } from "@/utils/cacheInvalidation";
import { EventCreationResult } from "@/components/CreateEventModal";

/**
 * Transforms event creation data to EventItem format
 * Returns null if the event should be filtered out based on role
 */
function transformEventToEventItem(
  eventData: EventCreationResult,
  userRole: string | null
): EventItem | null {
  const { event, post, profile, media } = eventData;

  // Role filtering: Only show events from 'regular' users to other 'regular' users
  const authorRole = profile.role;
  if (userRole === "regular" && authorRole !== "regular") {
    return null; // Skip this event
  }
  if (userRole !== "regular" && authorRole === "regular") {
    return null; // Skip this event
  }

  // Format date using the same logic as fetchEventsPage
  const startDate = new Date(event.starts_at);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // Get first media (sorted by order_index)
  const firstMedia = media
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0] ?? null;

  return {
    id: event.id,
    post_id: event.post_id,
    title: post?.title || "Untitled Event",
    description: post?.body || "",
    datetime: formattedDate,
    location: event.location_name || event.location_address || "Location TBD",
    imageSrc: firstMedia?.url,
    organizer: profile.full_name || "Unknown",
    attendees: 0, // New event has 0 attendees
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    location_name: event.location_name,
    location_address: event.location_address,
    external_url: event.external_url,
    event_type: event.event_type,
    audience: event.audience,
    logistics: event.logistics,
    special_interests: event.special_interests,
    time_based: event.time_based,
  };
}

export default function EventsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"events" | "calendar">("events");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [togglingAttend, setTogglingAttend] = useState<Record<string, boolean>>({});
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Get profile for query key
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Use React Query hook for events
  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
    error: eventsError,
  } = useEvents();

  // Consider loading if profile is loading OR events are loading
  const isLoading = profileLoading || loading;

  // Flatten all pages of events into a single array
  const events: EventItem[] = data?.pages.flatMap((page) => page.events) ?? [];
  
  // Combine attendee counts and joined status from all pages
  const attendeeCounts: Record<string, number> = {};
  const joinedMap: Record<string, boolean> = {};
  
  data?.pages.forEach((page) => {
    Object.assign(attendeeCounts, page.attendeeCounts);
    Object.assign(joinedMap, page.joinedMap);
  });

  const handleToggleAttend = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    
    // Prevent multiple clicks
    if (togglingAttend[eventId]) return;
    
    setTogglingAttend((prev) => ({ ...prev, [eventId]: true }));

    const currentlyJoined = joinedMap[eventId];
    const currentCount = attendeeCounts[eventId] || 0;

    // Optimistically update the cache
    const queryKey = ["events", profile?.role, profile?.university_id];
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          attendeeCounts: {
            ...page.attendeeCounts,
            [eventId]: currentlyJoined
              ? Math.max(0, currentCount - 1)
              : currentCount + 1,
          },
          joinedMap: {
            ...page.joinedMap,
            [eventId]: !currentlyJoined,
          },
        })),
      };
    });

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        // Revert optimistic update
        queryClient.invalidateQueries({ queryKey: ["events", profile?.role, profile?.university_id] });
        alert("You must be signed in to attend events.");
        setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
        return;
      }

      // Get user's profile ID
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profileError || !userProfile) {
        // Revert optimistic update
        queryClient.invalidateQueries({ queryKey: ["events", profile?.role, profile?.university_id] });
        console.error("Error getting profile:", profileError);
        alert("Failed to get your profile.");
        setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
        return;
      }

      const userId = userProfile.id;

      if (currentlyJoined) {
        // Unattend: Delete from event_attendees
        const { error: deleteError } = await supabase
          .from("event_attendees")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId);

        if (deleteError) {
          // Revert optimistic update
          queryClient.invalidateQueries({ queryKey: ["events", profile?.role, profile?.university_id] });
          console.error("Error un-attending event:", deleteError);
          alert("Failed to un-attend event. Please try again.");
          setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
          return;
        }
      } else {
        // Attend: Insert into event_attendees
        const { error: insertError } = await supabase
          .from("event_attendees")
          .insert({
            event_id: eventId,
            user_id: userId,
            status: "interested", // Default status
          });

        if (insertError) {
          // If it's a unique constraint error, the user is already attending
          if (insertError.code === "23505") {
            // Already attending, cache is already updated optimistically
          } else {
            // Revert optimistic update
            queryClient.invalidateQueries({ queryKey: ["events", profile?.role, profile?.university_id] });
            console.error("Error attending event:", insertError);
            alert("Failed to attend event. Please try again.");
            setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
            return;
          }
        }
      }
    } catch (err) {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ["events", profile?.role, profile?.university_id] });
      console.error("Unexpected error toggling attend:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  // Load more events function
  const loadMoreEvents = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchNextPage();
  }, [loadingMore, hasMore, fetchNextPage]);

  // Infinite scroll with intersection observer
  useEffect(() => {
    if (activeTab !== "events" || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreEvents();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loadingMore, activeTab, loadMoreEvents]);

  const handleShare = async (e: React.MouseEvent, ev: EventItem) => {
    e.stopPropagation();
    // native share if available
    const url = `${location.origin}/events/${ev.id}`;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: ev.title,
          text: ev.description,
          url,
        });
      } catch (_) {}
      return;
    }
    // fallback: copy link
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    } catch {
      router.push(`/events/${ev.id}`);
    }
  };

  const handleEventCreated = useCallback(
    (eventData: EventCreationResult) => {
      setShowCreateModal(false);

      // Transform the event data to EventItem format
      const newEventItem = transformEventToEventItem(eventData, profile?.role || null);

      // If event is filtered out (returns null), fall back to refetch
      if (!newEventItem) {
        invalidateEvents(queryClient);
        return;
      }

      // Optimistically update the cache by prepending to the first page
      const queryKey = ["events", profile?.role, profile?.university_id];
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || !old.pages || old.pages.length === 0) {
          // If cache structure doesn't match, fall back to invalidation
          invalidateEvents(queryClient);
          return old;
        }

        // Create updated pages array
        const updatedPages = [...old.pages];
        
        // Update the first page
        const firstPage = { ...updatedPages[0] };
        firstPage.events = [newEventItem, ...firstPage.events];
        firstPage.attendeeCounts = {
          ...firstPage.attendeeCounts,
          [newEventItem.id]: 0, // New event has 0 attendees
        };
        firstPage.joinedMap = {
          ...firstPage.joinedMap,
          [newEventItem.id]: false, // User hasn't joined their own event yet
        };
        
        updatedPages[0] = firstPage;

        return {
          ...old,
          pages: updatedPages,
        };
      });
    },
    [queryClient, profile?.role]
  );

  return (
    <main className="flex justify-center p-4 md:p-6 lg:p-8 bg-[var(--bg-primary)] min-h-screen transition-colors">
      {/* Center container */}
      <div className="w-full max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-accent)]">
              {activeTab === "events" ? "Events" : "Calendar"}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {activeTab === "events"
                ? "See upcoming events and add them to your calendar."
                : "View your joined events on the calendar."}
            </p>
          </div>
          {activeTab === "events" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-2 py-1.5 sm:px-4 sm:py-2 bg-[var(--color-accent)] text-white rounded-md text-xs sm:text-sm font-medium hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
            >
              <span className="hidden sm:inline"> + </span>Create Event
            </button>
          )}
        </header>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-[var(--card-border)]">
          <button
            onClick={() => setActiveTab("events")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "events"
                ? "text-[var(--color-accent)] border-[var(--color-accent)]"
                : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "calendar"
                ? "text-[var(--color-accent)] border-[var(--color-accent)]"
                : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
            }`}
          >
            Calendar
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === "events" ? (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mx-auto">
              {eventsError ? (
                <div className="col-span-full text-center py-8 text-red-500">
                  {eventsError instanceof Error
                    ? eventsError.message
                    : "Error loading events. Please try again."}
                </div>
              ) : isLoading ? (
                <div className="col-span-full text-center py-8 text-[var(--text-secondary)]">
                  Loading events...
                </div>
              ) : events.length === 0 ? (
                <div className="col-span-full text-center py-8 text-[var(--text-secondary)]">
                  No events found. Create one to get started!
                </div>
              ) : (
                events.map((ev) => {
                  const joined = !!joinedMap[ev.id];
                  const attendeeCount = attendeeCounts[ev.id] ?? ev.attendees ?? 0;
                  const isToggling = togglingAttend[ev.id] || false;
                  
                  // Create event object with updated attendee count
                  const eventWithCount = {
                    ...ev,
                    attendees: attendeeCount,
                  };

                  return (
                    <EventsCard
                      key={ev.id}
                      event={eventWithCount}
                      joined={joined}
                      onToggleAttend={handleToggleAttend}
                      onShare={handleShare}
                      onClick={() => router.push(`/events/${ev.id}`)}
                      isToggling={isToggling}
                    />
                  );
                })
              )}
            </section>
            
            {/* Load More Section */}
            {!loading && events.length > 0 && (
              <div className="mt-8 flex justify-center">
                {hasMore ? (
                  <div ref={loadMoreRef} className="w-full">
                    <button
                      onClick={loadMoreEvents}
                      disabled={loadingMore}
                      className="w-full max-w-xs mx-auto px-6 py-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingMore ? "Loading..." : "Load More Events"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-sm text-[var(--text-secondary)] py-4">
                    No more events to load
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <EventsCalendar />
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleEventCreated}
        />
      )}
    </main>
  );
}
