// app/events/EventsClient.tsx
"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CreateEventModal from "@/components/CreateEventModal";
import EventsCard from "@/components/EventsCard";
import EventsCalendar from "@/components/EventsCalendar";

type EventItem = {
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
};

export default function EventsClient() {
  const [activeTab, setActiveTab] = useState<"events" | "calendar">("events");
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingAttend, setTogglingAttend] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const handleToggleAttend = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    
    // Prevent multiple clicks
    if (togglingAttend[eventId]) return;
    
    setTogglingAttend((prev) => ({ ...prev, [eventId]: true }));

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        alert("You must be signed in to attend events.");
        setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
        return;
      }

      // Get user's profile ID
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Error getting profile:", profileError);
        alert("Failed to get your profile.");
        setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
        return;
      }

      const userId = profile.id;
      const currentlyJoined = joinedMap[eventId];

      if (currentlyJoined) {
        // Unattend: Delete from event_attendees
        const { error: deleteError } = await supabase
          .from("event_attendees")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId);

        if (deleteError) {
          console.error("Error un-attending event:", deleteError);
          alert("Failed to un-attend event. Please try again.");
          setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
          return;
        }

        // Update local state
        setJoinedMap((prev) => ({ ...prev, [eventId]: false }));
        setAttendeeCounts((prev) => ({
          ...prev,
          [eventId]: Math.max(0, (prev[eventId] || 0) - 1),
        }));
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
            // Already attending, just update local state
            setJoinedMap((prev) => ({ ...prev, [eventId]: true }));
          } else {
            console.error("Error attending event:", insertError);
            alert("Failed to attend event. Please try again.");
            setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
            return;
          }
        } else {
          // Successfully inserted
          setJoinedMap((prev) => ({ ...prev, [eventId]: true }));
          setAttendeeCounts((prev) => ({
            ...prev,
            [eventId]: (prev[eventId] || 0) + 1,
          }));
        }
      }
    } catch (err) {
      console.error("Unexpected error toggling attend:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setTogglingAttend((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  // Load events from Supabase
  useEffect(() => {
    let mounted = true;

    const loadEvents = async () => {
      setLoading(true);

      try {
        // 1. Get current authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          console.error("Auth error:", authError);
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // 2. Get user's profile to check role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Failed to load profile:", profileError);
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // 3. Build query - only show events from 'regular' users to other 'regular' users
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
            posts!inner (
              id,
              title,
              body,
              created_at,
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
          `
          )
          .order("starts_at", { ascending: true });

        // Filter: Only show events from 'regular' users to other 'regular' users
        // If user is not 'regular', they won't see events from 'regular' users
        const userRole = (profile as any)?.role;
        if (userRole === "regular") {
          // Regular users can only see events from other regular users
          // This filtering happens at the database level via RLS or we filter in the query
          // For now, we'll load all events and filter client-side
          // TODO: Implement proper RLS policy for this
        }

        const { data: eventsData, error: eventsError } = await query;

        if (eventsError) {
          console.error("Error loading events:", eventsError);
          if (!mounted) return;
          setLoading(false);
          return;
        }

        if (!mounted) return;

        // 4. Get all event IDs
        const eventIds = (eventsData ?? []).map((row: any) => row.id);

        // 5. Get attendee counts for all events
        const { data: attendeeCountsData, error: attendeeCountsError } = await supabase
          .from("event_attendees")
          .select("event_id")
          .in("event_id", eventIds);

        if (attendeeCountsError) {
          console.error("Error loading attendee counts:", attendeeCountsError);
        }

        // Count attendees per event
        const countsMap: Record<string, number> = {};
        (attendeeCountsData ?? []).forEach((row: any) => {
          countsMap[row.event_id] = (countsMap[row.event_id] || 0) + 1;
        });

        // 6. Get current user's attendee status for all events
        const { data: userAttendeesData, error: userAttendeesError } = await supabase
          .from("event_attendees")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", eventIds);

        if (userAttendeesError) {
          console.error("Error loading user attendees:", userAttendeesError);
        }

        // Map user's attendance status
        const userJoinedSet = new Set(
          (userAttendeesData ?? []).map((row: any) => row.event_id)
        );

        // 7. Map events data
        const mapped: EventItem[] = (eventsData ?? [])
          .map((row: any) => {
            const post = row.posts as any;
            const author = post?.profiles as any;
            const media = (post?.post_media as any[]) ?? [];
            const firstMedia =
              media
                .slice()
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0] ??
              null;

            // Filter: Only show events from 'regular' users to other 'regular' users
            const authorRole = author?.role;
            if (userRole === "regular" && authorRole !== "regular") {
              return null; // Skip this event
            }
            if (userRole !== "regular" && authorRole === "regular") {
              return null; // Skip this event
            }

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
            };
          })
          .filter((e: EventItem | null) => e !== null) as EventItem[];

        setEvents(mapped);
        
        // Set attendee counts and joined status
        setAttendeeCounts(countsMap);
        const joinedStatus: Record<string, boolean> = {};
        eventIds.forEach((eventId: string) => {
          joinedStatus[eventId] = userJoinedSet.has(eventId);
        });
        setJoinedMap(joinedStatus);
      } catch (err) {
        console.error("Unexpected error loading events:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadEvents();

    return () => {
      mounted = false;
    };
  }, []);

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

  const handleEventCreated = () => {
    // Reload events after creation
    window.location.reload();
  };

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
              className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
            >
              + Create Event
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
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mx-auto">
            {loading ? (
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
