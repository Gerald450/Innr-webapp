"use client";

import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { invalidateEvents } from "@/utils/cacheInvalidation";

export default function EventEditPage() {
  const params = useParams();
  const eventId = params?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  /** Call this after successfully saving event changes so the events list and detail refetch. */
  const handleEditSuccess = () => {
    invalidateEvents(queryClient);
    router.push(`/events/${eventId}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Edit event</h1>
          <p className="text-[var(--text-secondary)] mb-4">
            Event editing will be available here. For now, you can view your event.
          </p>
          <Link
            href={`/events/${eventId}`}
            className="inline-block px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition"
          >
            View event
          </Link>
        </div>
      </div>
    </div>
  );
}
