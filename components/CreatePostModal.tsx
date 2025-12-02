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

      const { data: mediaRow, error: mediaError } = await supabase
        .from("post_media")
        .insert({
          post_id: postId,
          // TODO: derive real media_type from file.type; using "image" as default.
          media_type: "image",
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
    time: string;
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
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);

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
    const urls = mediaFiles.map((file) => URL.createObjectURL(file));
    setMediaPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
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
          ? String((profile as any).graduation_year)
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
        time: "just now",
        gradYear: displayGradYear,
        images: uploadedMedia.map((m) => m.url),
      });

      // 4. Reset state and close modal
      setText("");
      setMediaFiles([]);
      setMediaPreviews([]);
      onClose();
    } catch (err) {
      console.error("Failed to create post:", err);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-6 md:pt-8 lg:pt-10"
      aria-modal="true"
      role="dialog"
    >
    
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="What's happening on campus?"
              className="w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-black"
            />
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 rounded-full px-2 py-1 text-gray-600 hover:bg-gray-100 text-black"
          >
            ✕
          </button>
        </div>

        {mediaPreviews.length ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {mediaPreviews.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt="preview" className="max-h-32 rounded-md" />
                <button
                  onClick={() => {
                    const newFiles = [...mediaFiles];
                    newFiles.splice(i, 1);
                    setMediaFiles(newFiles);
                  }}
                  className="absolute top-0 right-0 text-sm text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100">
            <input
              type="file"
              accept="image/*,video/*,application/pdf"
              onChange={handleMediaChange}
              className="hidden"
              multiple
            />
            <span className="text-sm text-gray-600">Attach media</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 text-black"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)]"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
