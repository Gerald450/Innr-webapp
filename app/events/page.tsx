// app/events/EventsClient.tsx
"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CreateEventModal from "@/components/CreateEventModal";

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
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleToggleAttend = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setJoinedMap((prev) => ({ ...prev, [id]: !prev[id] }));
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

        // 4. Map events data
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
              attendees: 0, // TODO: Get from attendees table
              starts_at: row.starts_at,
              ends_at: row.ends_at,
              location_name: row.location_name,
              location_address: row.location_address,
              external_url: row.external_url,
            };
          })
          .filter((e: EventItem | null) => e !== null) as EventItem[];

        setEvents(mapped);
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
              Events
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              See upcoming events and add them to your calendar.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
          >
            + Create Event
          </button>
        </header>

        {/* Centered, smaller cards - LinkedIn style */}
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

            return (
              <article
                key={ev.id}
                role="button"
                onClick={() => router.push(`/events/${ev.id}`)}
                className="cursor-pointer bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] shadow-sm overflow-hidden hover:shadow-md transition-colors"
              >
                {/* MOBILE: flex row | DESKTOP: block */}
                <div className="flex md:block w-full">
                  {/* IMAGE */}
                  <div className="w-24 h-24 md:w-full md:h-56 flex-shrink-0 overflow-hidden flex items-center justify-center bg-[var(--bg-primary)]">
                    <img
                      src={ev.imageSrc}
                      alt={ev.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* CONTENT + BUTTONS */}
                  <div className="flex flex-1 flex-col p-3">
                    {/* TOP SECTION (date + title + location) */}
                    <div className="flex-1">
                      <div className="text-xs text-[var(--text-secondary)]">
                        {ev.datetime}
                      </div>

                      <h2 className="text-sm font-semibold leading-tight text-[var(--text-primary)] line-clamp-2">
                        {ev.title}
                      </h2>

                      {/* description only desktop */}
                      <p className="hidden md:block text-xs text-[var(--text-secondary)] line-clamp-2">
                        {ev.description}
                      </p>

                      <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                        <svg
                          className="w-4 h-4 text-neutral-400"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 11a3 3 0 100-6 3 3 0 000 6z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M21 20c0-4.97-4.03-9-9-9s-9 4.03-9 9"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="truncate">{ev.location}</span>
                      </div>
                    </div>

                    {/* ACTION ROW */}
                    <div className="flex items-center justify-end md:justify-between mt-2">
                      {/* LEFT SIDE ONLY DESKTOP (view + attendees) */}
                      <div className="hidden md:flex items-center gap-2">
                        <Link
                          href={`/events/${ev.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs border border-[var(--color-accent)] text-[var(--color-accent)] rounded-full hover:bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] transition"
                        >
                          View
                        </Link>

                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {ev.organizer && <span>{ev.organizer}</span>}
                          <span className="mx-1">·</span>
                          <span>{ev.attendees} attending</span>
                        </div>
                      </div>

                      {/* RIGHT SIDE — ALWAYS VISIBLE */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAttend(e, ev.id)}
                          className={`px-4 py-1.5 rounded-md text-xs font-medium border ${
                            joined
                              ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                              : "bg-[var(--card-bg)] text-[var(--color-accent)] border-[var(--color-accent)]"
                          }`}
                        >
                          {joined ? "Joined" : "Attend"}
                        </button>

                       
                        <button
                          type="button"
                          onClick={(e) => handleShare(e, ev)}
                          aria-label="Share event"
                          className="flex h-8 w-8 border border-[var(--card-border)] rounded-full items-center justify-center hover:bg-[var(--bg-primary)] transition-colors"
                        >
                          <img
                            src="/svgs/share.svg"
                            alt="Share"
                            className="w-4 h-4"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
            })
          )}
        </section>
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
