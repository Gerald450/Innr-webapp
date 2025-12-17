 "use client";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Upload media to Supabase Storage and create post_media records.
async function uploadPostMedia(
  postId: string,
  authorId: string,
  files: File[]
): Promise<{ url: string }[]> {
  const uploads = await Promise.all(
    files.map(async (file, index) => {
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `${authorId}/${postId}/${Date.now()}-${index}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(filePath, file);

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

      return mediaRow as { url: string };
    })
  );

  return uploads;
}

type CreatePostModalProps = {
  initialName?: string;
  initialGradYear?: string;
  onClose: () => void;
  onSubmit: (post: {
    id: string;
    name: string;
    text: string;
    created_at: string;
    gradYear: string;
    images: string[]; // now multiple media URLs
  }) => void;
};

export default function CreatePostModal({
  initialName = "",
  initialGradYear = "",
  onClose,
  onSubmit,
}: CreatePostModalProps) {
  const [name, setName] = useState(initialName);
  const [gradYear, setGradYear] = useState(initialGradYear);
  const [text, setText] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<Array<{ url: string; type: string; id: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!text.trim() && !mediaFiles.length) return; // must have content
    setIsSubmitting(true);

    try {
      // 0. Ensure we have an authenticated user and their profile (for university + display data)
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth error while creating post:", authError);
        return;
      }
      if (!user) {
        console.error("No authenticated user; cannot create post.");
        return;
      }

      const authorId = user.id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, graduation_year, university_id")
        .eq("id", authorId)
        .single();

      if (profileError) {
        console.error("Failed to load profile for post:", profileError);
        return;
      }

      const universityId = (profile as any)?.university_id;
      if (!universityId) {
        console.error(
          "Profile has no university_id; cannot create post linked to a university."
        );
        return;
      }

      const displayName = (profile as any)?.full_name ?? initialName;
      const displayGradYear =
        (profile as any)?.graduation_year != null
          ? String((profile as any).graduation_year).slice(-2)
          : initialGradYear;

      // 1. Create the post in Supabase
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          author_id: authorId,
          university_id: universityId,
          post_type: mediaFiles.length ? "media" : "text",
          body: text.trim(),
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

      // 3. Pass created post back up to UI
      onSubmit({
        id: post.id,
        name: displayName,
        text: post.body ?? "",
        created_at: post.created_at,
        gradYear: displayGradYear,
        images: uploadedMedia.map((m) => m.url),
      });

      // 4. Reset state and close modal
      setText("");
      setMediaFiles([]);
      setMediaPreviews([]);
      setIsSubmitting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    } catch (err) {
      console.error("Failed to create post:", err);
      setIsSubmitting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-6 md:pt-8 lg:pt-15 px-4 pb-4 transition-colors"
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="w-full max-w-2xl rounded-2xl bg-[var(--card-bg)] shadow-xl border border-[var(--card-border)] transition-colors overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Create Post</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
            disabled={isSubmitting}
          >
            <svg
              className="w-5 h-5"
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

        {/* Content */}
        <div className="p-6">
          {/* Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="What's happening on campus?"
            className="w-full resize-none rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
            disabled={isSubmitting}
          />

          {/* Media Previews */}
          {mediaPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
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

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-between gap-4">
            {/* Media Upload Button */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg)] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf"
                onChange={handleMediaChange}
                className="hidden"
                multiple
                disabled={isSubmitting}
              />
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium">Add Media</span>
            </label>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg border border-[var(--card-border)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (!text.trim() && !mediaFiles.length)}
                className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
