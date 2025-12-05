"use client";
import React from "react";
import Link from "next/link";

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

type EventsCardProps = {
  event: EventItem;
  joined: boolean;
  onToggleAttend: (e: React.MouseEvent, id: string) => void;
  onShare: (e: React.MouseEvent, event: EventItem) => void;
  onClick?: () => void;
  isToggling?: boolean;
};

// Truncate description to consistent length
const truncateDescription = (text: string | undefined, maxLength: number = 100): string => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

export default function EventsCard({
  event,
  joined,
  onToggleAttend,
  onShare,
  onClick,
  isToggling = false,
}: EventsCardProps) {
  const truncatedDescription = truncateDescription(event.description, 100);

  return (
    <article
      role="button"
      onClick={onClick}
      className="cursor-pointer bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] shadow-sm overflow-hidden hover:shadow-md transition-colors"
    >
      {/* MOBILE: flex row | DESKTOP: block */}
      <div className="flex md:block w-full">
        {/* IMAGE */}
        <div className="w-24 h-24 md:w-full md:h-56 flex-shrink-0 overflow-hidden flex items-center justify-center bg-[var(--bg-primary)]">
          <img
            src={event.imageSrc}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* CONTENT + BUTTONS */}
        <div className="flex flex-1 flex-col p-3">
          {/* TOP SECTION (date + title + location) */}
          <div className="flex-1">
            <div className="text-xs text-[var(--text-secondary)]">
              {event.datetime}
            </div>

            <h2 className="text-sm font-semibold leading-tight text-[var(--text-primary)] line-clamp-2">
              {event.title}
            </h2>

            {/* description only desktop */}
            {truncatedDescription && (
              <p className="hidden md:block text-xs text-[var(--text-secondary)] mt-1">
                {truncatedDescription}
              </p>
            )}

            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
              <svg
                className="w-4 h-4 text-[var(--text-secondary)]"
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
              <span className="truncate">{event.location}</span>
            </div>
          </div>

          {/* ACTION ROW */}
          <div className="flex items-center justify-end md:justify-between mt-2">
            {/* LEFT SIDE ONLY DESKTOP (view + attendees) */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href={`/events/${event.id}`}
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 text-xs border border-[var(--color-accent)] text-[var(--color-accent)] rounded-full hover:bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] transition"
              >
                View
              </Link>

              <div className="text-[11px] text-[var(--text-secondary)]">
                {event.organizer && <span>{event.organizer}</span>}
                <span className="mx-1">·</span>
                <span>{event.attendees} attending</span>
              </div>
            </div>

            {/* RIGHT SIDE — ALWAYS VISIBLE */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => onToggleAttend(e, event.id)}
                disabled={isToggling}
                className={`px-4 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  joined
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                    : "bg-[var(--card-bg)] text-[var(--color-accent)] border-[var(--color-accent)]"
                } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isToggling ? "..." : joined ? "Joined" : "Attend"}
              </button>

              <button
                type="button"
                onClick={(e) => onShare(e, event)}
                aria-label="Share event"
                className="flex h-8 w-8 border border-[var(--card-border)] rounded-full items-center justify-center hover:bg-[var(--bg-primary)] transition-colors"
              >
                <img
                  src="/svgs/share.svg"
                  alt="Share"
                  className="w-4 h-4 svg-icon"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

