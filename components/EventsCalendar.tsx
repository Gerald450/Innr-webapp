"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  location_name?: string;
  location_address?: string;
  location: string;
};

type EventsByDate = Record<string, CalendarEvent[]>;

export default function EventsCalendar() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventsByDate, setEventsByDate] = useState<EventsByDate>({});
  const [loading, setLoading] = useState(true);
  const eventsDetailsRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Load user's joined events
  useEffect(() => {
    let mounted = true;

    const loadUserEvents = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // Get user's profile ID
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // Get events user has joined
        const { data: attendeesData, error: attendeesError } = await supabase
          .from("event_attendees")
          .select(
            `
            event_id,
            events!inner (
              id,
              starts_at,
              ends_at,
              location_name,
              location_address,
              posts!inner (
                title
              )
            )
          `
          )
          .eq("user_id", profile.id);

        if (attendeesError) {
          console.error("Error loading user events:", attendeesError);
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // Organize events by date
        const eventsMap: EventsByDate = {};
        (attendeesData ?? []).forEach((row: any) => {
          const event = row.events as any;
          const post = event?.posts as any;
          if (!event || !post) return;

          const startDate = new Date(event.starts_at);
          const dateKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;

          if (!eventsMap[dateKey]) {
            eventsMap[dateKey] = [];
          }

          eventsMap[dateKey].push({
            id: event.id,
            title: post.title || "Untitled Event",
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            location_name: event.location_name,
            location_address: event.location_address,
            location: event.location_name || event.location_address || "Location TBD",
          });
        });

        if (mounted) {
          setEventsByDate(eventsMap);
        }
      } catch (err) {
        console.error("Unexpected error loading events:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUserEvents();

    return () => {
      mounted = false;
    };
  }, []);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
    setSelectedDate(null);
  };

  const getDateKey = (day: number) => {
    const date = new Date(year, month, day);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    
    // Scroll to events details after a short delay to ensure it's rendered
    setTimeout(() => {
      if (eventsDetailsRef.current) {
        eventsDetailsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, 100);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const hasEvents = (day: number) => {
    const dateKey = getDateKey(day);
    return eventsByDate[dateKey] && eventsByDate[dateKey].length > 0;
  };

  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    return eventsByDate[dateKey] || [];
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--text-secondary)]">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth("prev")}
          className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          aria-label="Previous month"
        >
          <svg
            className="w-5 h-5 text-[var(--text-primary)]"
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
        </button>

        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {monthNames[month]} {year}
        </h2>

        <button
          onClick={() => navigateMonth("next")}
          className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          aria-label="Next month"
        >
          <svg
            className="w-5 h-5 text-[var(--text-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-6 transition-colors">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-[var(--text-secondary)] py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="aspect-square" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1;
            const dateKey = getDateKey(day);
            const eventsOnDay = eventsByDate[dateKey] || [];
            const isSelected =
              selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === month &&
              selectedDate.getFullYear() === year;

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={`aspect-square rounded-lg border-2 transition-all relative ${
                  isToday(day)
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : isSelected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/20"
                    : hasEvents(day)
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10"
                    : "border-transparent hover:bg-[var(--bg-primary)]"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    isToday(day)
                      ? "text-[var(--color-accent)]"
                      : isSelected
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {day}
                </div>
                {eventsOnDay.length > 0 && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {eventsOnDay.slice(0, 3).map((_, eventIdx) => (
                      <div
                        key={eventIdx}
                        className="w-1 h-1 rounded-full bg-[var(--color-accent)]"
                      />
                    ))}
                    {eventsOnDay.length > 3 && (
                      <div className="w-1 h-1 rounded-full bg-[var(--text-secondary)]" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Events */}
      {selectedDate && getSelectedDateEvents().length > 0 && (
        <div
          ref={eventsDetailsRef}
          className="mt-6 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-6 transition-colors"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Events on {selectedDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h3>
          <div className="space-y-4">
            {getSelectedDateEvents().map((event) => (
              <div
                key={event.id}
                onClick={() => router.push(`/events/${event.id}`)}
                className="p-4 rounded-lg border border-[var(--card-border)] hover:bg-[var(--bg-primary)] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-[var(--text-primary)] mb-2">
                      {event.title}
                    </h4>
                    <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{formatTime(event.starts_at)}</span>
                        {event.ends_at && (
                          <span> - {formatTime(event.ends_at)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
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
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{event.location}</span>
                      </div>
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDate && getSelectedDateEvents().length === 0 && (
        <div
          ref={eventsDetailsRef}
          className="mt-6 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-6 text-center transition-colors"
        >
          <p className="text-[var(--text-secondary)]">
            No events on {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      )}
    </div>
  );
}

