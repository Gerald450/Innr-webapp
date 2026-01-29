"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

type EventItem = {
  id: string;
  post_id: string;
  title: string;
  datetime: string;
  location: string;
  imageSrc?: string;
  images?: string[];
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
  const tagsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showArrows, setShowArrows] = useState(false);

  const imageList = event.images?.length ? event.images : (event.imageSrc ? [event.imageSrc] : []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasMultipleImages = imageList.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % imageList.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
  };

  const goToImage = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [event.id]);

  // Collect all tags into a single array
  const allTags = [
    ...(event.event_type || []),
    ...(event.audience || []),
    ...(event.logistics || []),
    ...(event.special_interests || []),
    ...(event.time_based || []),
  ];

  // Check scroll position and update arrow visibility
  const checkScroll = () => {
    const container = tagsContainerRef.current;
    if (!container) return;

    const canScroll = container.scrollWidth > container.clientWidth;
    setShowArrows(canScroll);
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  useEffect(() => {
    checkScroll();
    const container = tagsContainerRef.current;
    if (!container) return;

    // Check on resize
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(container);

    container.addEventListener("scroll", checkScroll);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", checkScroll);
    };
  }, [allTags]);

  const scrollLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tagsContainerRef.current) {
      // Scroll by approximately 80% of container width on mobile, fixed amount on desktop
      const scrollAmount = window.innerWidth < 768 
        ? tagsContainerRef.current.clientWidth * 0.8 
        : 100;
      tagsContainerRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tagsContainerRef.current) {
      // Scroll by approximately 80% of container width on mobile, fixed amount on desktop
      const scrollAmount = window.innerWidth < 768 
        ? tagsContainerRef.current.clientWidth * 0.8 
        : 100;
      tagsContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <article
      role="button"
      onClick={onClick}
      className="cursor-pointer bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] shadow-sm overflow-hidden hover:shadow-md transition-colors md:h-auto"
    >
      {/* MOBILE: flex row | DESKTOP: block */}
      <div className="flex md:block w-full items-stretch">
        {/* IMAGE - Left thumbnail on mobile; carousel when multiple */}
        <div className="w-24 h-[140px] md:w-full md:h-56 flex-shrink-0 overflow-hidden flex items-center justify-center bg-[var(--bg-primary)] relative">
          {imageList.length > 0 ? (
            <div className="relative w-full h-full">
              {imageList.map((src, index) => (
                <div
                  key={index}
                  className={`transition-opacity duration-300 w-full h-full ${
                    index === currentImageIndex ? "opacity-100 relative" : "opacity-0 absolute inset-0"
                  }`}
                >
                  <Image
                    src={src}
                    alt={`${event.title} ${index + 1}`}
                    width={400}
                    height={224}
                    className="w-full h-full object-cover"
                    loading="lazy"
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
                    onClick={prevImage}
                    className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors md:left-2 md:w-8 md:h-8"
                    aria-label="Previous image"
                  >
                    <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors md:right-2 md:w-8 md:h-8"
                    aria-label="Next image"
                  >
                    <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {imageList.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => goToImage(e, idx)}
                        className={`transition-all rounded-full ${
                          idx === currentImageIndex ? "bg-white w-4 h-1.5" : "bg-white/50 w-1.5 h-1.5 hover:bg-white/75"
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-[var(--bg-primary)] flex items-center justify-center">
              <span className="text-[var(--text-secondary)] text-xs">No image</span>
            </div>
          )}
        </div>

        {/* CONTENT SECTION - Middle and Right on mobile */}
        <div className="flex flex-1 flex-row md:flex-col p-3 md:p-3">
          {/* MIDDLE SECTION (date + title + location + tags + additional info) */}
          <div className="flex-1 pr-3 md:pr-0 min-w-0">
            <div className="text-xs text-[var(--text-secondary)]">
              {event.datetime}
            </div>

            <h2 className="text-sm font-semibold leading-tight text-[var(--text-primary)] line-clamp-2 mt-1">
              {event.title}
            </h2>

            {/* description only desktop */}
            {truncatedDescription && (
              <p className="hidden md:block text-xs text-[var(--text-secondary)] mt-1">
                {truncatedDescription}
              </p>
            )}

            {/* Tags - Mobile: Show 2 tags, Desktop: Carousel */}
            {allTags.length > 0 && (
              <>
                {/* Mobile: Show only 2 tags */}
                <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1 md:hidden">
                  {allTags.slice(0, 2).map((tag, idx) => (
                    <span
                      key={`tag-mobile-${idx}`}
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20 whitespace-nowrap"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Desktop: Full carousel */}
                <div className="hidden md:block relative mt-2 mb-1">
                  {/* Left Arrow */}
                  {showArrows && canScrollLeft && (
                    <button
                      onClick={scrollLeft}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-sm border border-[var(--card-border)] hover:bg-[var(--card-bg)] transition-colors"
                      aria-label="Scroll tags left"
                    >
                      <svg
                        className="w-3 h-3 text-[var(--text-primary)]"
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
                  )}

                  {/* Tags Container */}
                  <div
                    ref={tagsContainerRef}
                    className="flex gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth px-0.5"
                    style={{ 
                      scrollbarWidth: "none", 
                      msOverflowStyle: "none",
                      WebkitOverflowScrolling: "touch"
                    }}
                  >
                    {allTags.map((tag, idx) => (
                      <span
                        key={`tag-desktop-${idx}`}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/20 whitespace-nowrap flex-shrink-0"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Right Arrow */}
                  {showArrows && canScrollRight && (
                    <button
                      onClick={scrollRight}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-sm border border-[var(--card-border)] hover:bg-[var(--card-bg)] transition-colors"
                      aria-label="Scroll tags right"
                    >
                      <svg
                        className="w-3 h-3 text-[var(--text-primary)]"
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
                  )}
                </div>
              </>
            )}

            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 mt-1.5">
              <svg
                className="w-3.5 h-3.5 text-[var(--text-secondary)] flex-shrink-0"
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

            {/* Additional info on mobile (organizer, attendee count) - share is with Attend button */}
            <div className="flex items-center gap-2 mt-1.5 md:hidden text-[10px] text-[var(--text-secondary)]">
              {event.organizer && (
                <>
                  <span className="truncate">{event.organizer}</span>
                  <span>·</span>
                </>
              )}
              <span>{event.attendees ?? 0} attending</span>
            </div>
          </div>

          {/* RIGHT SECTION - Attend button and loading indicator on mobile */}
          <div className="flex flex-col items-end justify-start md:static md:flex-row md:items-center md:justify-between md:mt-2 md:w-full">
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

            {/* RIGHT SIDE — Attend and Share buttons (column on mobile, row on desktop) */}
            <div className="flex flex-col items-end gap-2 md:flex-row md:items-center md:gap-2">
              <button
                type="button"
                onClick={(e) => onToggleAttend(e, event.id)}
                disabled={isToggling}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  joined
                    ? "bg-[var(--color-accent)] text-white border border-[var(--color-accent)] md:rounded-md"
                    : "bg-[var(--card-bg)] text-[var(--color-accent)] border border-[var(--color-accent)] md:rounded-md"
                } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isToggling ? "..." : joined ? "Joined" : "Attend"}
              </button>

              {/* Loading indicator - only on mobile, only when toggling */}
              {isToggling && (
                <div className="w-4 h-4 md:hidden flex items-center justify-center">
                  <svg
                    className="animate-spin text-[var(--text-secondary)]"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Segmented circle - 8 segments */}
                    {[...Array(8)].map((_, i) => (
                      <line
                        key={i}
                        x1="8"
                        y1="1"
                        x2="8"
                        y2="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity={i < 4 ? "0.6" : "0.2"}
                        transform={`rotate(${i * 45} 8 8)`}
                      />
                    ))}
                  </svg>
                </div>
              )}

              {/* Share button */}
              <button
                type="button"
                onClick={(e) => onShare(e, event)}
                aria-label="Share event"
                className="flex h-8 w-8 border border-[var(--card-border)] rounded-full items-center justify-center hover:bg-[var(--bg-primary)] transition-colors flex-shrink-0"
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

