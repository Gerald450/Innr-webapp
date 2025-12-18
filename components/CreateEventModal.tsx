"use client";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Upload media to Supabase Storage and create post_media records.
async function uploadPostMedia(
  postId: string,
  authorId: string,
  files: File[]
): Promise<{ url: string }[]> {
  // Upload files sequentially for large videos to prevent UI blocking
  // Use Promise.allSettled to handle errors gracefully
  const uploads: { url: string }[] = [];
  
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

    uploads.push(mediaRow as { url: string });
  }

  return uploads;
}

type CreateEventModalProps = {
  onClose: () => void;
  onSuccess?: () => void;
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
    if (!locationAddress.trim()) {
      alert("Please enter a location address");
      return;
    }
    if (mediaFiles.length === 0) {
      alert("Please upload at least one event image or media file");
      return;
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
        .select("full_name, graduation_year, university_id")
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
      let uploadedMedia: { url: string }[] = [];
      if (mediaFiles.length) {
        uploadedMedia = await uploadPostMedia(post.id, authorId, mediaFiles);
      }

      // 3. Create the event record linked to the post
      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({
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
        })
        .select()
        .single();

      if (eventError || !event) {
        // If event creation fails, we should ideally rollback the post
        // For now, just log the error
        console.error("Event creation failed:", eventError);
        throw eventError || new Error("Event insert failed");
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
      setIsSubmitting(false);
      onClose();
      if (onSuccess) onSuccess();
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
                className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors datetime-input"
              />
            </div>
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
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--text-primary)] bg-[var(--card-bg)] placeholder:text-[var(--text-secondary)] transition-colors"
                placeholder="Full address"
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

