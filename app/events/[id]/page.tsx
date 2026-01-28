"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { getRelativeTime } from "@/utils/relativeTime";

type EventDetail = {
  id: string;
  post_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at?: string;
  location_name?: string;
  location_address?: string;
  external_url?: string;
  imageSrc?: string;
  organizer?: string;
  organizerId?: string;
  organizerAvatar?: string;
  created_at?: string;
  images?: string[];
  event_type?: string[] | null;
  audience?: string[] | null;
  logistics?: string[] | null;
  special_interests?: string[] | null;
  time_based?: string[] | null;
};

export default function EventDetail() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [attendeeCount, setAttendeeCount] = useState<number>(0);
  const [showAttendeesModal, setShowAttendeesModal] = useState<boolean>(false);
  const [attendees, setAttendees] = useState<Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }>>([]);
  const [loadingAttendees, setLoadingAttendees] = useState<boolean>(false);
  const [isShowingFiltered, setIsShowingFiltered] = useState<boolean>(false);
  const attendeesModalOverlayRef = useRef<HTMLDivElement | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [event?.id]);

  useEffect(() => {
    if (!eventId) return;

    let mounted = true;

    const loadEvent = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch event with related post data
        const { data: eventData, error: eventErr } = await supabase
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
              profiles!inner (
                id,
                full_name,
                avatar_url,
                role
              ),
              post_media (
                url,
                order_index
              )
            )
          `
          )
          .eq("id", eventId)
          .single();

        if (eventErr || !eventData) {
          console.error("Error loading event:", eventErr);
          if (!mounted) return;
          setError("Event not found");
          return;
        }

        if (!mounted) return;

        const eventDataTyped = eventData as any;
        const post = eventDataTyped.posts as any;
        const author = post?.profiles as any;
        const media = (post?.post_media as any[]) ?? [];
        const sortedMedia = media
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const allImages = sortedMedia.map((m: any) => m.url).filter(Boolean);
        const firstMedia = sortedMedia[0] ?? null;

        const startDate = new Date(eventDataTyped.starts_at);
        const formattedDate = startDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const formattedTime = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

        let endDateStr = "";
        let endTimeStr = "";
        if (eventDataTyped.ends_at) {
          const endDate = new Date(eventDataTyped.ends_at);
          endDateStr = endDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          endTimeStr = endDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
        }

        const eventDetail: EventDetail = {
          id: eventDataTyped.id,
          post_id: eventDataTyped.post_id,
          title: post?.title || "Untitled Event",
          description: post?.body || "",
          starts_at: eventDataTyped.starts_at,
          ends_at: eventDataTyped.ends_at,
          location_name: eventDataTyped.location_name,
          location_address: eventDataTyped.location_address,
          external_url: eventDataTyped.external_url,
          imageSrc: firstMedia?.url,
          images: allImages.length > 0 ? allImages : undefined,
          organizer: author?.full_name || "Unknown",
          organizerId: author?.id,
          organizerAvatar: author?.avatar_url,
          created_at: post?.created_at,
          event_type: eventDataTyped.event_type,
          audience: eventDataTyped.audience,
          logistics: eventDataTyped.logistics,
          special_interests: eventDataTyped.special_interests,
          time_based: eventDataTyped.time_based,
        };

        setEvent(eventDetail);

        // Check if user has joined and get attendee count
        if (user) {
          // Get user's profile ID
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .single();

          if (!profileError && profile) {
            const userId = profile.id;

            // Check if user is attending
            // Use maybeSingle() instead of single() since user might not be attending
            const { data: userAttendee, error: attendeeError } = await supabase
              .from("event_attendees")
              .select("id")
              .eq("event_id", eventId)
              .eq("user_id", userId)
              .maybeSingle();

            if (!attendeeError && userAttendee) {
              setJoined(true);
            } else {
              setJoined(false);
            }

            // Get attendee count
            const { count, error: countErr } = await supabase
              .from("event_attendees")
              .select("*", { count: "exact", head: true })
              .eq("event_id", eventId);

            if (!countErr && count !== null) {
              setAttendeeCount(count);
            }
          }
        } else {
          // If not authenticated, still get attendee count
          const { count, error: countErr } = await supabase
            .from("event_attendees")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventId);

          if (!countErr && count !== null) {
            setAttendeeCount(count);
          }
        }
      } catch (err) {
        console.error("Unexpected error loading event:", err);
        if (mounted) setError("Failed to load event");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadEvent();

    return () => {
      mounted = false;
    };
  }, [eventId]);

  // Handle escape key for attendees modal
  useEffect(() => {
    if (!showAttendeesModal) return;
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseAttendeesModal();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showAttendeesModal]);

  const handleToggleAttend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJoining) return;

    setIsJoining(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert("Please sign in to attend events");
        setIsJoining(false);
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
        setIsJoining(false);
        return;
      }

      const userId = profile.id;
      const currentlyJoined = joined;

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
          setIsJoining(false);
          return;
        }

        // Update local state
        setJoined(false);
        setAttendeeCount((prev) => Math.max(0, prev - 1));
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
            setJoined(true);
          } else {
            console.error("Error attending event:", insertError);
            alert("Failed to attend event. Please try again.");
            setIsJoining(false);
            return;
          }
        } else {
          // Successfully inserted
          setJoined(true);
          setAttendeeCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error("Error toggling attendance:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!event) return;

    const url = `${window.location.origin}/events/${event.id}`;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: event.title,
          text: event.description,
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
      console.error("Failed to copy link");
    }
  };

  const handleShowAttendees = async () => {
    if (!eventId || !event) return;
    
    setShowAttendeesModal(true);
    setLoadingAttendees(true);

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        // If not authenticated, don't show attendees
        setAttendees([]);
        setLoadingAttendees(false);
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
        setAttendees([]);
        setLoadingAttendees(false);
        return;
      }

      const currentUserId = profile.id;
      const isEventCreator = event.organizerId === currentUserId;

      // Fetch all attendees with their profile information
      const { data: attendeesData, error: attendeesError } = await supabase
        .from("event_attendees")
        .select(`
          user_id,
          profiles!inner (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("event_id", eventId);

      if (attendeesError) {
        console.error("Error fetching attendees:", attendeesError);
        setAttendees([]);
        setIsShowingFiltered(false);
      } else {
        // Transform the data to a simpler structure
        let transformedAttendees = (attendeesData || []).map((item: any) => ({
          id: item.profiles.id,
          full_name: item.profiles.full_name,
          avatar_url: item.profiles.avatar_url,
        }));

        // If not the event creator, filter to only show connections
        if (!isEventCreator) {
          setIsShowingFiltered(true);
          // Get attendee IDs
          const attendeeIds = transformedAttendees.map(a => a.id);
          
          if (attendeeIds.length > 0) {
            // Check connections: either user follows attendee OR attendee follows user (both must be accepted)
            const [followsUserData, followedByUserData] = await Promise.all([
              // Attendees that current user follows (accepted connections only)
              supabase
                .from("follows")
                .select("following_id")
                .eq("follower_id", currentUserId)
                .eq("status", "accepted")
                .in("following_id", attendeeIds),
              // Attendees that follow current user (accepted connections only)
              supabase
                .from("follows")
                .select("follower_id")
                .eq("following_id", currentUserId)
                .eq("status", "accepted")
                .in("follower_id", attendeeIds)
            ]);

            const followsUserIds = new Set(
              (followsUserData.data || []).map((f: any) => f.following_id)
            );
            const followedByUserIds = new Set(
              (followedByUserData.data || []).map((f: any) => f.follower_id)
            );

            // Filter attendees to only those who are accepted connections
            transformedAttendees = transformedAttendees.filter(attendee => 
              followsUserIds.has(attendee.id) || followedByUserIds.has(attendee.id)
            );
          }
        } else {
          setIsShowingFiltered(false);
        }

        setAttendees(transformedAttendees);
      }
    } catch (err) {
      console.error("Unexpected error loading attendees:", err);
      setAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleCloseAttendeesModal = () => {
    setShowAttendeesModal(false);
    setAttendees([]);
    setIsShowingFiltered(false);
  };

  const handleAttendeesModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === attendeesModalOverlayRef.current) {
      handleCloseAttendeesModal();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="text-lg text-[var(--text-secondary)]">Loading event...</div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 transition-colors">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {error || "Event not found"}
          </h1>
          <p className="text-[var(--text-secondary)] mb-4">
            The event you're looking for doesn't exist or has been deleted.
          </p>
          <Link
            href="/events"
            className="inline-block px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
          >
            Back to Events
        </Link>
        </div>
      </div>
    );
  }

  const startDate = new Date(event.starts_at);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  let endDateStr = "";
  let endTimeStr = "";
  if (event.ends_at) {
    const endDate = new Date(event.ends_at);
    endDateStr = endDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    endTimeStr = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const location = event.location_name || event.location_address || "Location TBD";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-colors"
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
      </div>

      {/* Hero Image / Carousel */}
      <div className="max-w-4xl mx-auto px-4 mb-6">
        <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] rounded-2xl overflow-hidden bg-[var(--card-bg)]">
          {(() => {
            const imageList = event.images?.length ? event.images : (event.imageSrc ? [event.imageSrc] : []);
            const hasMultipleImages = imageList.length > 1;

            if (imageList.length === 0) {
              return (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent)]/5">
                  <div className="text-center">
                    <svg
                      className="w-16 h-16 mx-auto text-[var(--color-accent)]/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>
              );
            }

            return (
              <div className="relative w-full h-full">
                {imageList.map((src, index) => (
                  <div
                    key={index}
                    className={`transition-opacity duration-500 w-full h-full ${
                      index === currentImageIndex ? "opacity-100 relative" : "opacity-0 absolute inset-0"
                    }`}
                  >
                    <Image
                      src={src}
                      alt={`${event.title} ${index + 1}`}
                      width={1200}
                      height={600}
                      className="w-full h-full object-cover"
                      priority={index === 0}
                      loading={index === 0 ? "eager" : "lazy"}
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/images/avatar_placeholder.png";
                      }}
                    />
                  </div>
                ))}
                {hasMultipleImages && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex((p) => (p - 1 + imageList.length) % imageList.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      aria-label="Previous image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex((p) => (p + 1) % imageList.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      aria-label="Next image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                      {imageList.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`transition-all rounded-full ${
                            idx === currentImageIndex ? "bg-white w-8 h-2" : "bg-white/50 w-2 h-2 hover:bg-white/75"
                          }`}
                          aria-label={`Go to image ${idx + 1}`}
                        />
                      ))}
                    </div>
                    <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1.5 rounded-lg z-10">
                      {currentImageIndex + 1} / {imageList.length}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        {/* Event Card */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] p-6 md:p-8 mb-6 transition-colors">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {event.title}
          </h1>

          {/* Attendee Count */}
          {attendeeCount > 0 && (
            <button
              onClick={handleShowAttendees}
              className="text-sm text-[var(--text-secondary)] mb-4 hover:text-[var(--text-primary)] transition-colors cursor-pointer underline-offset-2 hover:underline"
            >
              {attendeeCount} {attendeeCount === 1 ? "person is" : "people are"} attending
            </button>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              onClick={handleToggleAttend}
              disabled={isJoining}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                joined
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                  : "bg-[var(--card-bg)] text-[var(--color-accent)] border-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isJoining ? "..." : joined ? "Joined" : "Attend"}
            </button>

            <button
              onClick={handleShare}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-2"
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
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </button>

            {event.external_url && (
              <a
                href={event.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 rounded-lg text-sm font-semibold border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-2"
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Learn More
              </a>
            )}
          </div>

          <hr className="border-[var(--card-border)] mb-6" />

          {/* Event Details Grid */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-[var(--color-accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Date & Time
                </div>
                <div className="font-semibold text-[var(--text-primary)]">{formattedDate}</div>
                <div className="text-sm text-[var(--text-secondary)]">{formattedTime}</div>
                {event.ends_at && (
                  <>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">Until</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      {endDateStr !== formattedDate ? endDateStr : ""} {endTimeStr}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-[var(--color-accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Location
                </div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {event.location_name || "Location TBD"}
                </div>
                {event.location_address && (
                  <div className="text-sm text-[var(--text-secondary)]">
                    {event.location_address}
                  </div>
                )}
              </div>
            </div>

            {/* Organizer */}
            {event.organizer && (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {event.organizerAvatar ? (
                    <img
                      src={event.organizerAvatar}
                      alt={event.organizer}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      className="w-6 h-6 text-[var(--color-accent)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Organizer
                  </div>
                  {event.organizerId ? (
                    <button
                      onClick={() => router.push(`/users/${event.organizerId}`)}
                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--color-accent)] transition-colors text-left"
                    >
                      {event.organizer}
                    </button>
                  ) : (
                    <div className="font-semibold text-[var(--text-primary)]">
                      {event.organizer}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <hr className="border-[var(--card-border)] mb-6" />

          {/* Tags */}
          {(event.event_type?.length || event.audience?.length || event.logistics?.length || event.special_interests?.length || event.time_based?.length) && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {event.event_type?.map((tag, idx) => (
                  <span
                    key={`event_type-${idx}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20"
                  >
                    {tag}
                  </span>
                ))}
                {event.audience?.map((tag, idx) => (
                  <span
                    key={`audience-${idx}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20"
                  >
                    {tag}
                  </span>
                ))}
                {event.logistics?.map((tag, idx) => (
                  <span
                    key={`logistics-${idx}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20"
                  >
                    {tag}
                  </span>
                ))}
                {event.special_interests?.map((tag, idx) => (
                  <span
                    key={`special_interests-${idx}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20"
                  >
                    {tag}
                  </span>
                ))}
                {event.time_based?.map((tag, idx) => (
                  <span
                    key={`time_based-${idx}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <hr className="border-[var(--card-border)] mb-6" />

          {/* Description */}
            <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
              About This Event
            </h2>
            <div className="text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
              {event.description || "No description provided."}
            </div>
          </div>

          {/* Created Date */}
          {event.created_at && (
            <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
              <div className="text-xs text-[var(--text-secondary)]">
                Created {getRelativeTime(event.created_at)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendees Modal */}
      {showAttendeesModal && (
        <div
          ref={attendeesModalOverlayRef}
          onClick={handleAttendeesModalOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-md max-h-[80vh] rounded-2xl bg-[var(--card-bg)] p-6 shadow-xl transition-colors flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {isShowingFiltered ? "Your Connections" : "Attendees"} ({isShowingFiltered ? attendees.length : attendeeCount})
                </h2>
                {isShowingFiltered && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Only showing attendees you're connected with
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseAttendeesModal}
                aria-label="Close"
                className="rounded-full px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2">
              {loadingAttendees ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  Loading attendees...
                </div>
              ) : attendees.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  {isShowingFiltered 
                    ? "None of your connections are attending this event."
                    : "No attendees found."}
                </div>
              ) : (
                <div className="space-y-3">
                  {attendees.map((attendee) => (
                    <button
                      key={attendee.id}
                      onClick={() => {
                        router.push(`/users/${attendee.id}`);
                        handleCloseAttendeesModal();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-primary)] flex-shrink-0">
                        {attendee.avatar_url ? (
                          <img
                            src={attendee.avatar_url}
                            alt={attendee.full_name || "User"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/images/avatar_placeholder.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[var(--color-accent)]/10">
                            <svg
                              className="w-6 h-6 text-[var(--color-accent)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">
                          {attendee.full_name || "Unknown User"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
  );
}
