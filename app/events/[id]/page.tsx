// app/events/[id]/page.tsx
import { events } from "../../../data/events";
import Image from "next/image";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventDetail({ params }: Props) {
  const resolved = await params;
  const id = String(resolved.id);

  const ev = events.find((e) => String(e.id) === id);

  if (!ev) {
    return (
      <main className="p-6 text-black">
        <p>Event not found</p>
        <Link href="/events" className="text-blue-600 underline">
          Back to events
        </Link>
      </main>
    );
  }

  const date = new Date(ev.datetime);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeRange = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="max-w-xl mx-auto pb-20 text-black">
      {/* Hero */}
      <div className="relative">
        <div className="h-[260px] md:h-[320px] w-full overflow-hidden rounded-b-2xl bg-gray-50">
          <Image
            src={ev.imageSrc}
            alt={ev.title}
            fill
            className="object-contain object-center"
          />
        </div>
      </div>

      {/* Card - smaller overlap, higher z so it sits above hero cleanly */}
      <div className="-mt-12 md:-mt-16 mx-4 bg-white p-6 rounded-lg shadow-xl relative z-20">
        <h2 className="text-xl font-semibold mb-2">
          {ev.title} is happening at UAPB
        </h2>

        <div className="grid gap-4 mt-4">
          {/* Date */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-gray-100 grid place-items-center flex-shrink-0">
              📅
            </div>
            <div>
              <div className="font-semibold">{dateStr}</div>
              <div className="text-gray-600">{timeRange}</div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gray-100 grid place-items-center flex-shrink-0">
              📍
            </div>
            <div>
              <div className="font-semibold">{ev.location.split(",")[0]}</div>
              <div className="text-gray-600">
                {ev.location.split(",").slice(1).join(", ").trim()}
              </div>
            </div>
          </div>

          {/* Organizer */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 relative rounded-md overflow-hidden flex-shrink-0">
              <Image
                src={ev.imageSrc}
                alt={ev.organizer}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="font-semibold">{ev.organizer}</div>
              <div className="text-gray-600">{ev.attendees} attendees</div>
            </div>
          </div>
        </div>

        <hr className="my-5 border-gray-200" />

        {/* Description */}
        <h3 className="font-medium mb-2 text-lg">About Event</h3>
        <p className="text-black leading-relaxed">{ev.description}</p>
      </div>

      <div className="px-4 mt-4">
        <Link href="/events" className="text-blue-600">
          ← Back to events
        </Link>
      </div>
    </main>
  );
}
