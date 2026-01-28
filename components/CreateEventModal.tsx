"use client";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AddressAutocomplete from "@/components/AddressAutocomplete";

// Upload media to Supabase Storage and create post_media records.
async function uploadPostMedia(
  postId: string,
  authorId: string,
  files: File[]
): Promise<Array<{ url: string; order_index: number; [key: string]: any }>> {
  // Upload files sequentially for large videos to prevent UI blocking
  // Use Promise.allSettled to handle errors gracefully
  const uploads: Array<{ url: string; order_index: number; [key: string]: any }> = [];
  
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const ext = file.name.split(".").pop() || "bin";
    const filePath = `${authorId}/${postId}/${Date.now()}-${index}.${ext}`;

    // Yield to event loop periodically to prevent UI freeze
    if (index > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("post-media")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError || !uploadData) {
      throw uploadError || new Error("Upload failed without error details");
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-media").getPublicUrl(uploadData.path);

    // Derive media_type from file.type
    let mediaType = "image"; // default
    if (file.type.startsWith("video/")) {
      mediaType = "video";
    } else if (file.type.startsWith("image/")) {
      mediaType = "image";
    } else if (file.type === "application/pdf") {
      mediaType = "pdf";
    }

    const { data: mediaRow, error: mediaError } = await supabase
      .from("post_media")
      .insert({
        post_id: postId,
        media_type: mediaType,
        storage_path: uploadData.path,
        url: publicUrl,
        order_index: index,
      })
      .select()
      .single();

    if (mediaError || !mediaRow) {
      throw mediaError || new Error("post_media insert failed");
    }

    uploads.push(mediaRow);
  }

  return uploads;
}

export type EventCreationResult = {
  event: any; // Event record from database
  post: any; // Post record from database
  profile: {
    full_name: string | null;
    role: string | null;
  };
  media: Array<{
    url: string;
    order_index: number;
  }>;
};

type CreateEventModalProps = {
  onClose: () => void;
  onSuccess?: (eventData: EventCreationResult) => void;
};

// Multi-select dropdown component
type MultiSelectProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

function MultiSelect({ label, options, selected, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors text-left flex items-center justify-between"
      >
        <span className={selected.length === 0 ? "text-[var(--text-secondary)]" : ""}>
          {selected.length === 0
            ? placeholder || "Select options..."
            : `${selected.length} selected`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center px-3 py-2 hover:bg-[var(--bg-primary)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
                className="mr-2 rounded border-[var(--card-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">{option}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md"
            >
              {item}
              <button
                type="button"
                onClick={() => toggleOption(item)}
                className="hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateEventModal({
  onClose,
  onSuccess,
}: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [eventType, setEventType] = useState<string[]>([]);
  const [audience, setAudience] = useState<string[]>([]);
  const [logistics, setLogistics] = useState<string[]>([]);
  const [specialInterest, setSpecialInterest] = useState<string[]>([]);
  const [timeBased, setTimeBased] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<Array<{ url: string; type: string; id: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<"daily" | "weekly" | "biweekly" | "monthly" | "yearly" | null>(null);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number | null>(null);
  const [recurrenceEndsNever, setRecurrenceEndsNever] = useState(true);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  // Options for dropdowns
  const eventTypeOptions = [
    "Academic",
    "Social",
    "Cultural",
    "Athletic/Recreation",
    "Career/Professional",
    "Community Service",
    "Club Meeting",
    "Wellness",
    "Greek Life",
    "Religious/Spiritual",
    "Other",
  ];

  const audienceOptions = [
    "All Students",
    "Undergrad Only",
    "Graduate Students",
    "Freshmen", 
    "Sophomores",
    "Juniors",
    "Seniors",
    "Alumni",
    "Faculty/Staff Welcome",
    "Commuter Students",
    "International Students",
    "Major/Department",
    "Other",
  ];

  const logisticsOptions = [
    "Free",
    "Food Provided",
    "RSVP Required",
    "Limited Capacity",
    "Outdoor Event",
    "Virtual/Hybrid Event",
    "Recurring Series",
    "Other",
  ];

  const specialInterestOptions = [
    "Arts & Music",
    "Technology/STEM",
    "Sustainability",
    "Diversity & Inclusion",
    "Other",
  ];

  const timeBasedOptions = [
    "Orientation Week",
    "Homecoming",
    "Finals Week",
    "Late Night",
    "Other",
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!mediaFiles.length) {
      setMediaPreviews([]);
      return;
    }
    const previews = mediaFiles.map((file, index) => ({
      url: URL.createObjectURL(file),
      type: file.type,
      id: `${file.name}-${file.size}-${index}-${Date.now()}`,
    }));
    setMediaPreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [mediaFiles]);

  // Default recurrence_days_of_week from start date when weekly/biweekly and none selected
  useEffect(() => {
    if (!isRecurring || !startsAt) return;
    if (recurrencePattern !== "weekly" && recurrencePattern !== "biweekly") return;
    if (recurrenceDaysOfWeek.length > 0) return;
    const d = new Date(startsAt);
    setRecurrenceDaysOfWeek([d.getDay()]);
  }, [isRecurring, startsAt, recurrencePattern, recurrenceDaysOfWeek.length]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setMediaFiles(files);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      alert("Please enter an event title");
      return;
    }
    if (!description.trim()) {
      alert("Please enter an event description");
      return;
    }
    if (!startsAt) {
      alert("Please select a start date and time");
      return;
    }
    // Validate that start date is not in the past
    const startDateTime = new Date(startsAt);
    const now = new Date();
    if (startDateTime < now) {
      alert("Start date and time cannot be in the past");
      return;
    }
    // Validate that end date is after start date (if provided)
    if (endsAt) {
      const endDateTime = new Date(endsAt);
      if (endDateTime <= startDateTime) {
        alert("End date and time must be after the start date and time");
        return;
      }
    }
    if (!locationAddress.trim()) {
      alert("Please enter a location address");
      return;
    }
    if (mediaFiles.length === 0) {
      alert("Please upload at least one event image or media file");
      return;
    }
    if (isRecurring) {
      if (!recurrencePattern) {
        alert("Please select a repeat pattern (e.g. Daily, Weekly) for recurring events.");
        return;
      }
      if ((recurrencePattern === "weekly" || recurrencePattern === "biweekly") && recurrenceDaysOfWeek.length === 0) {
        alert("Please select at least one day of the week for weekly/biweekly recurrence.");
        return;
      }
      if (!recurrenceEndsNever && !recurrenceEndDate) {
        alert("Please choose an end date for the recurrence, or select \"Never\".");
        return;
      }
      if (!recurrenceEndsNever && recurrenceEndDate && startsAt) {
        const end = new Date(recurrenceEndDate);
        const start = new Date(startsAt);
        if (end < start) {
          alert("Recurrence end date must be on or after the event start date.");
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // 0. Get authenticated user and profile
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Auth error:", authError);
        alert("You must be signed in to create an event");
        return;
      }

      const authorId = user.id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, graduation_year, university_id, role")
        .eq("id", authorId)
        .single();

      if (profileError || !profile) {
        console.error("Failed to load profile:", profileError);
        alert("Failed to load your profile");
        return;
      }

      const universityId = (profile as any)?.university_id;
      if (!universityId) {
        alert("Your profile is missing a university");
        return;
      }

      const userRole = (profile as any)?.role;
      if (userRole !== "admin") {
        alert("Only admins can create events");
        return;
      }

      // 1. Create the post (with post_type = 'event')
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          author_id: authorId,
          university_id: universityId,
          post_type: "event",
          title: title.trim(),
          body: description.trim(),
          visibility: "public",
        })
        .select()
        .single();

      if (postError || !post) {
        throw postError || new Error("Post insert failed");
      }

      // 2. Upload media (if any) and create post_media rows
      let uploadedMedia: Array<{ url: string; order_index: number }> = [];
      if (mediaFiles.length) {
        const mediaResults = await uploadPostMedia(post.id, authorId, mediaFiles);
        uploadedMedia = mediaResults.map((mediaRow: any) => ({
          url: mediaRow.url,
          order_index: mediaRow.order_index,
        }));
      }

      // 3. Build event payload, including recurrence if enabled
      const eventPayload: Record<string, unknown> = {
        post_id: post.id,
        starts_at: startsAt,
        ends_at: endsAt || null,
        location_name: locationName.trim() || null,
        location_address: locationAddress.trim() || null,
        external_url: externalUrl.trim() || null,
        event_type: eventType.length > 0 ? eventType : null,
        audience: audience.length > 0 ? audience : null,
        logistics: logistics.length > 0 ? logistics : null,
        special_interests: specialInterest.length > 0 ? specialInterest : null,
        time_based: timeBased.length > 0 ? timeBased : null,
      };

      if (isRecurring && recurrencePattern) {
        eventPayload.is_recurring = true;
        eventPayload.recurrence_pattern = recurrencePattern;
        eventPayload.recurrence_interval = Math.max(1, recurrenceInterval);
        if (!recurrenceEndsNever && recurrenceEndDate) {
          eventPayload.recurrence_end_date = new Date(recurrenceEndDate + "T23:59:59").toISOString();
        }
        if ((recurrencePattern === "weekly" || recurrencePattern === "biweekly") && recurrenceDaysOfWeek.length > 0) {
          eventPayload.recurrence_days_of_week = recurrenceDaysOfWeek;
        }
        if (recurrencePattern === "monthly") {
          const dom = recurrenceDayOfMonth ?? (startsAt ? new Date(startsAt).getDate() : null);
          if (dom !== null) eventPayload.recurrence_day_of_month = dom;
        }
      }

      let event: { id: string; [k: string]: unknown } | null = null;
      const { data: insertData, error: insertError } = await supabase
        .from("events")
        .insert(eventPayload)
        .select()
        .single();

      if (insertError) {
        const isDuplicatePostId =
          (insertError.code === "23505" || (insertError as { status?: number }).status === 409) &&
          (insertError.message?.includes("events_post_id_key") ||
            insertError.message?.includes("duplicate key") ||
            insertError.message?.includes("already exists"));

        if (isDuplicatePostId) {
          const { data: existingEvent, error: fetchError } = await supabase
            .from("events")
            .select("*")
            .eq("post_id", post.id)
            .maybeSingle();

          if (fetchError || !existingEvent) {
            console.error("Event fetch (after duplicate) failed:", fetchError);
            throw fetchError || new Error("Event already exists but could not be fetched");
          }
          event = existingEvent as { id: string; [k: string]: unknown };
        } else {
          console.error("Event creation failed:", insertError);
          throw insertError || new Error("Event insert failed");
        }
      } else {
        event = insertData as { id: string; [k: string]: unknown };
      }

      if (!event) {
        throw new Error("Event insert failed");
      }

      // 4. Reset and close
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setLocationName("");
      setLocationAddress("");
      setExternalUrl("");
      setEventType([]);
      setAudience([]);
      setLogistics([]);
      setSpecialInterest([]);
      setTimeBased([]);
      setMediaFiles([]);
      setMediaPreviews([]);
      setIsRecurring(false);
      setRecurrencePattern(null);
      setRecurrenceInterval(1);
      setRecurrenceDaysOfWeek([]);
      setRecurrenceDayOfMonth(null);
      setRecurrenceEndsNever(true);
      setRecurrenceEndDate("");
      setIsSubmitting(false);
      onClose();
      if (onSuccess) {
        onSuccess({
          event,
          post,
          profile: {
            full_name: (profile as any)?.full_name || null,
            role: (profile as any)?.role || null,
          },
          media: uploadedMedia,
        });
      }
    } catch (err) {
      console.error("Failed to create event:", err);
      alert("Failed to create event. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-[var(--card-bg)] p-6 shadow-xl transition-colors flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Create Event</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] placeholder:text-[var(--text-secondary)] transition-colors"
              placeholder="Enter event title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe your event..."
              className="w-full resize-none rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] placeholder:text-[var(--text-secondary)] transition-colors"
            />
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Start Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors datetime-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                min={startsAt || new Date().toISOString().slice(0, 16)}
                className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors datetime-input"
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="rounded-lg border border-[var(--card-border)] p-4 space-y-4 bg-[var(--bg-primary)]/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsRecurring(checked);
                  if (checked) {
                    setRecurrencePattern("weekly");
                    setRecurrenceInterval(1);
                    setRecurrenceEndsNever(true);
                    setRecurrenceEndDate("");
                  } else {
                    setRecurrencePattern(null);
                    setRecurrenceInterval(1);
                    setRecurrenceDaysOfWeek([]);
                    setRecurrenceDayOfMonth(null);
                    setRecurrenceEndsNever(true);
                    setRecurrenceEndDate("");
                  }
                }}
                className="rounded border-[var(--card-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-sm font-medium text-[var(--text-primary)]">This is a recurring event</span>
            </label>

            {isRecurring && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      Repeats <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={recurrencePattern ?? ""}
                      onChange={(e) => setRecurrencePattern((e.target.value || null) as typeof recurrencePattern)}
                      className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)]"
                    >
                      <option value="">Select pattern...</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  {(recurrencePattern === "daily" || recurrencePattern === "weekly" || recurrencePattern === "biweekly" || recurrencePattern === "monthly" || recurrencePattern === "yearly") && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        Every
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
                          className="w-20 rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)]"
                        />
                        <span className="text-sm text-[var(--text-secondary)]">
                          {recurrencePattern === "daily" && (recurrenceInterval === 1 ? "day" : "days")}
                          {recurrencePattern === "weekly" && (recurrenceInterval === 1 ? "week" : "weeks")}
                          {recurrencePattern === "biweekly" && (recurrenceInterval === 1 ? "2 weeks" : `${recurrenceInterval * 2} weeks`)}
                          {recurrencePattern === "monthly" && (recurrenceInterval === 1 ? "month" : "months")}
                          {recurrencePattern === "yearly" && (recurrenceInterval === 1 ? "year" : "years")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {(recurrencePattern === "weekly" || recurrencePattern === "biweekly") && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Repeat on
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                        <label
                          key={day}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--card-border)] cursor-pointer hover:bg-[var(--bg-primary)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-accent)_15%,transparent)]"
                        >
                          <input
                            type="checkbox"
                            checked={recurrenceDaysOfWeek.includes(i)}
                            onChange={() => {
                              if (recurrenceDaysOfWeek.includes(i)) {
                                setRecurrenceDaysOfWeek(recurrenceDaysOfWeek.filter((d) => d !== i));
                              } else {
                                setRecurrenceDaysOfWeek([...recurrenceDaysOfWeek, i].sort((a, b) => a - b));
                              }
                            }}
                            className="rounded border-[var(--card-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                          />
                          <span className="text-sm text-[var(--text-primary)]">{day}</span>
                        </label>
                      ))}
                    </div>
                    {recurrenceDaysOfWeek.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Pick at least one day (defaults to start day if none).</p>
                    )}
                  </div>
                )}

                {recurrencePattern === "monthly" && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      Day of month
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={recurrenceDayOfMonth ?? ""}
                        onChange={(e) => setRecurrenceDayOfMonth(e.target.value === "last" ? -1 : (e.target.value ? parseInt(e.target.value, 10) : null))}
                        className="rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)]"
                      >
                        <option value="">Same as start date</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        <option value="last">Last day of month</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Ends
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrenceEnd"
                        checked={recurrenceEndsNever}
                        onChange={() => { setRecurrenceEndsNever(true); setRecurrenceEndDate(""); }}
                        className="border-[var(--card-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">Never</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrenceEnd"
                        checked={!recurrenceEndsNever}
                        onChange={() => setRecurrenceEndsNever(false)}
                        className="border-[var(--card-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">On date</span>
                    </label>
                    {!recurrenceEndsNever && (
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        min={startsAt ? new Date(startsAt).toISOString().slice(0, 10) : undefined}
                        className="rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)]"
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Location Name
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] placeholder:text-[var(--text-secondary)] transition-colors"
                placeholder="e.g., Student Center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Location Address <span className="text-red-500">*</span>
              </label>
              <AddressAutocomplete
                value={locationAddress}
                onChange={setLocationAddress}
                placeholder="Full address"
                className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] placeholder:text-[var(--text-secondary)] transition-colors"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* External URL */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              External URL
            </label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] placeholder:text-[var(--text-secondary)] transition-colors"
              placeholder="https://..."
            />
          </div>

          {/* Dropdown Fields - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Event Type */}
            <div>
              <MultiSelect
                label="Event Type"
                options={eventTypeOptions}
                selected={eventType}
                onChange={setEventType}
                placeholder="Select event types..."
              />
            </div>

            {/* Audience */}
            <div>
              <MultiSelect
                label="Audience"
                options={audienceOptions}
                selected={audience}
                onChange={setAudience}
                placeholder="Select audience..."
              />
            </div>

            {/* Logistics */}
            <div>
              <MultiSelect
                label="Logistics"
                options={logisticsOptions}
                selected={logistics}
                onChange={setLogistics}
                placeholder="Select logistics..."
              />
            </div>

            {/* Special Interest */}
            <div>
              <MultiSelect
                label="Special Interest"
                options={specialInterestOptions}
                selected={specialInterest}
                onChange={setSpecialInterest}
                placeholder="Select special interests..."
              />
            </div>

            {/* Time Based */}
            <div>
              <MultiSelect
                label="Time Based"
                options={timeBasedOptions}
                selected={timeBased}
                onChange={setTimeBased}
                placeholder="Select time-based options..."
              />
            </div>
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Event Image/Media <span className="text-red-500">*</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm border border-[var(--card-border)] hover:bg-[var(--bg-primary)] transition-colors">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="hidden"
                multiple
                disabled={isSubmitting}
              />
              <span className="text-sm text-[var(--text-secondary)]">Attach media</span>
            </label>
            {mediaPreviews.length > 0 && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mediaPreviews.map((preview, i) => {
                  const isVideo = preview.type.startsWith("video/");
                  return (
                    <div key={preview.id} className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--card-border)] bg-[var(--bg-primary)]">
                      {isVideo ? (
                        <video 
                          src={preview.url} 
                          className="w-full h-full object-cover"
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <img 
                          src={preview.url} 
                          alt={`Preview ${i + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => {
                          const newFiles = [...mediaFiles];
                          const newPreviews = [...mediaPreviews];
                          newFiles.splice(i, 1);
                          newPreviews.splice(i, 1);
                          // Revoke the object URL before removing
                          URL.revokeObjectURL(preview.url);
                          setMediaFiles(newFiles);
                          setMediaPreviews(newPreviews);
                        }}
                        disabled={isSubmitting}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        aria-label="Remove media"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-[var(--card-border)] mt-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

