// app/events/EventsClient.tsx
"use client";
import React, { useState } from "react";

type EventItem = {
  id: string;
  title: string;
  datetime: string;
  location: string;
  imageSrc?: string;
};

const sampleEvents: EventItem[] = Array.from({ length: 8 }).map((_, i) => ({
  id: String(i + 1),
  title: "SGA General Meeting",
  datetime: "Thu, Apr 21 2:00 PM",
  location: "Kountz Kyle Room 104",
  imageSrc: "/images/sga.png", // put your image in public/images/
}));

function EventCard({ event }: { event: EventItem }) {
  const [joined, setJoined] = useState(false);

  const handleAttend = () => {
    if (joined) {
      setJoined(false);
      return;
    }
    setTimeout(() => {
      setJoined(true);
    }, 200);
  };

  return (
    <article
      className="flex items-center gap-3 py-3 px-2 md:p-4 bg-white rounded-md shadow-sm
                 border border-transparent hover:border-gray-100 transition"
      aria-labelledby={`event-title-${event.id}`}
      role="group"
    >
      <div className="flex-shrink-0">
        <img
          src={event.imageSrc}
          alt=""
          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-md"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-500">{event.datetime}</div>
        <h3
          id={`event-title-${event.id}`}
          className="font-semibold text-sm md:text-base text-neutral-900 truncate"
        >
          {event.title}
        </h3>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-1">
          <svg
            className="w-4 h-4 text-neutral-400"
            viewBox="0 0 24 24"
            fill="none"
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

      <div className="flex-shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={handleAttend}
          aria-pressed={joined}
          className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium
      ${joined ? "bg-green-700 text-white" : "bg-black text-white"}
      hover:scale-105 active:scale-95 transition-transform`}
        >
          {joined ? "Joined" : "Attend"}
        </button>

        <button
          type="button"
          className="hidden sm:flex items-center justify-center"
        >
          <img
            src="/svgs/share.svg"
            alt="Share"
            className="w-5 h-5 opacity-80 hover:opacity-100 transition"
          />
        </button>
      </div>
    </article>
  );
}

export default function EventsClient() {
  const events = sampleEvents;

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <header className="mb-4">
        <h2 className="text-center md:text-left text-lg font-semibold">
          Events
        </h2>
        <p className="text-center md:text-left text-sm text-neutral-500">
          See upcoming events and add them to your calendar.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </section>
    </main>
  );
}
