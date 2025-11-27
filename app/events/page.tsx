// app/events/EventsClient.tsx
"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type EventItem = {
  id: string;
  title: string;
  datetime: string;
  location: string;
  imageSrc?: string;
  organizer?: string;
  attendees?: number;
  description?: string;
};

const sampleEvents: EventItem[] = Array.from({ length: 200 }).map((_, i) => ({
  id: String(i + 1),
  title: i === 0 ? "STEEL CONSTRUCTION EXPO 2025" : "SGA General Meeting",
  datetime: "Thu, Nov 27, 2025, 1:00 AM",
  location: "Kountz Kyle Room 104",
  imageSrc: "/images/sga.png",
  organizer: "TradeIndia Trade Fairs",
  attendees: 17 + i * 5,
  description:
    "Short description for the event that shows a preview in the card.",
}));

export default function EventsClient() {
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const handleToggleAttend = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setJoinedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  return (
    <main className="flex justify-center p-4 md:p-6 lg:p-8">
      {/* Center container */}
      <div className="w-full max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-black">Events</h1>
          <p className="text-sm text-neutral-500 mt-1">
            See upcoming events and add them to your calendar.
          </p>
        </header>

        {/* Centered, smaller cards - LinkedIn style */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mx-auto">
          {sampleEvents.map((ev) => {
            const joined = !!joinedMap[ev.id];

            return (
              <article
                key={ev.id}
                role="button"
                onClick={() => router.push(`/events/${ev.id}`)}
                className="cursor-pointer bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition"
              >
                {/* MOBILE: flex row | DESKTOP: block */}
                <div className="flex md:block w-full">
                  {/* IMAGE */}
                  <div className="w-24 h-24 md:w-full md:h-36 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    <img
                      src={ev.imageSrc}
                      alt={ev.title}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* CONTENT + BUTTONS */}
                  <div className="flex flex-1 flex-col p-3">
                    {/* TOP SECTION (date + title + location) */}
                    <div className="flex-1">
                      <div className="text-xs text-neutral-500">
                        {ev.datetime}
                      </div>

                      <h2 className="text-sm font-semibold leading-tight text-neutral-900 line-clamp-2">
                        {ev.title}
                      </h2>

                      {/* description only desktop */}
                      <p className="hidden md:block text-xs text-neutral-500 line-clamp-2">
                        {ev.description}
                      </p>

                      <div className="text-xs text-neutral-500 flex items-center gap-2 mt-1">
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
                          className="px-3 py-1.5 text-xs border border-blue-400 text-blue-600 rounded-full hover:bg-blue-50 transition"
                        >
                          View
                        </Link>

                        <div className="text-[11px] text-neutral-500">
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
                          className={`px-4 py-1.5 rounded-md text-xs font-medium ${
                            joined
                              ? "bg-green-700 text-white"
                              : "bg-black text-white"
                          }`}
                        >
                          {joined ? "Joined" : "Attend"}
                        </button>

                        {/* SHARE ALWAYS SHOWS */}
                        <button
                          type="button"
                          onClick={(e) => handleShare(e, ev)}
                          aria-label="Share event"
                          className="flex h-8 w-8 border border-gray-200 rounded-full items-center justify-center hover:bg-gray-50 transition"
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
          })}
        </section>
      </div>
    </main>
  );
}
