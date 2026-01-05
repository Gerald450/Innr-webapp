
"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateProfile } from "@/utils/cacheInvalidation";

type ProfileRow = {
  id?: string;
  full_name?: string | null;
  username?: string | null;
  bio?: string | null;
  program_of_study?: string | null;
  graduation_year?: number | null;
  avatar_url?: string | null;
  student_type?: string | null;
};

export default function ProfileEditor() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow>({
    full_name: "",
    username: "",
    bio: "",
    program_of_study: "",
    graduation_year: null,
    avatar_url: null,
    student_type: null,
  });

  const [fetching, setFetching] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    "/images/avatar_placeholder.png"
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  // ---------- mount: fetch auth user and profile ----------
  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();

      setFetching(true);
      try {
        const {
          data: { user: authUser },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr) {
          console.error("Auth error:", authErr);
          if (!mounted) return;
          setMessage({
            type: "error",
            text: "Unable to verify authentication.",
          });
          return;
        }

        if (!authUser) {
          if (!mounted) return;
          setMessage({ type: "error", text: "Not signed in." });
          return;
        }

        if (!mounted) return;
        setUser(authUser);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "full_name, username, bio, program_of_study, graduation_year, avatar_url, student_type"
          )
          .eq("id", authUser.id)
          .single();

        if (profileError) {
          console.warn("No profile row or fetch error:", profileError);
          // keep defaults if no profile exists
        } else if (profileData) {
          if (!mounted) return;
          setProfile({
            full_name: profileData.full_name ?? "",
            username: profileData.username ?? "",
            bio: profileData.bio ?? "",
            program_of_study: profileData.program_of_study ?? "",
            graduation_year: profileData.graduation_year ?? null,
            avatar_url: profileData.avatar_url ?? null,
            student_type: profileData.student_type ?? null,
          });
          if (profileData.avatar_url) setAvatarPreview(profileData.avatar_url);
        }
      } catch (err) {
        console.error("Unexpected load error:", err);
        if (mounted)
          setMessage({
            type: "error",
            text: "Unexpected error loading profile.",
          });
      } finally {
        if (mounted) setFetching(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------- helper: upload avatar to storage via presigned URL ----------
  // This requests a signed upload URL from the server, PUTs the file there, then returns a viewable URL.
  async function uploadAvatarFile(file: File): Promise<string> {
    if (!user) throw new Error("Not authenticated");
    setUploadingAvatar(true);

    try {
      // create a deterministic path so we can overwrite: e.g. avatars/<userId>/avatar.png
      const ext = file.name.split(".").pop() ?? "jpg";
      const filename = `${user.id}_avatar_${Date.now()}.${ext}`;
      const bucket = "avatars";

      // 1) Request signed upload URL from server
      const resp = await fetch("/api/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket,
          name: filename,
          contentType: file.type,
        }),
      });

      const json = await resp.json();
      if (!resp.ok || json.error) {
        throw new Error(json.error ?? "Failed to get signed upload URL");
      }

      const uploadUrl: string = json.uploadUrl; // server maps data.signedUrl -> uploadUrl
      const storagePath: string = json.path; // path inside the bucket

      // 2) PUT the file to signed upload URL
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type, // must match contentType used for signed url
        },
        body: file,
      });

      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(`Upload failed: ${putRes.status} ${text}`);
      }

      // 3) Resolve a viewable URL.
      // If bucket is public, getPublicUrl returns an accessible permanent URL.
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);
      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }

      // If bucket is private, create a temporary signed read URL for immediate preview (1 hour)
      const { data: signedReadData, error: signedReadErr } =
        await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 60 * 60); // 1 hour

      if (signedReadErr) {
        console.warn("createSignedUrl (read) error:", signedReadErr);
        // fallback: return storage path so you can persist path in DB if needed
        return storagePath;
      }

      return signedReadData.signedUrl;
    } finally {
      setUploadingAvatar(false);
    }
  }

  // ---------- helper: remove avatar file using public URL (best-effort) ----------
  async function removeAvatarByUrl(url: string | null) {
    if (!url || !user) return;
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/");
      const idx = parts.indexOf("avatars");
      if (idx === -1) return;
      const path = parts.slice(idx + 1).join("/");
      const filePath = `avatars/${path}`;
      const { error } = await supabase.storage
        .from("avatars")
        .remove([filePath]);
      if (error) console.warn("Error removing avatar file:", error);
    } catch (err) {
      console.warn("Could not parse avatar URL to remove file:", err);
    }
  }

  // ---------- avatar file input handler ----------
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be smaller than 5MB." });
      return;
    }

    // optimistic local preview
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setMessage(null);

    try {
      const publicUrl = await uploadAvatarFile(file);
      setProfile((p) => ({ ...p, avatar_url: publicUrl }));
      setAvatarPreview(publicUrl); // switch to final url
      setMessage({
        type: "success",
        text: "Avatar uploaded. Click Save to persist profile.",
      });
    } catch (err: any) {
      console.error("Upload failed:", err);
      setMessage({
        type: "error",
        text: err?.message ?? "Avatar upload failed.",
      });
      setAvatarPreview("/images/avatar_placeholder.png");
    }
  }

  // ---------- remove avatar handler (clear DB & storage) ----------
  async function handleRemoveAvatar() {
    const currentUrl = profile.avatar_url ?? null;
    // optimistic UI clear
    setProfile((p) => ({ ...p, avatar_url: null }));
    setAvatarPreview(null);

    // remove file from storage (best-effort)
    await removeAvatarByUrl(currentUrl);

    // also update the DB to clear avatar_url for the user
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (error) {
        console.warn("Failed to clear avatar_url in DB:", error);
        setMessage({ type: "error", text: "Failed to clear avatar in DB." });
      } else {
        // Invalidate React Query cache to update all components in real-time
        invalidateProfile(queryClient, user.id);
        queryClient.invalidateQueries({ queryKey: ["avatar"] });
        
        // Update cached profile in localStorage
        const { setCachedProfile } = await import("@/utils/storage");
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profileData) {
          setCachedProfile(profileData);
        }
        
        setMessage({ type: "success", text: "Avatar removed." });
      }
    }
  }

  // ---------- submit handler: upsert profile including avatar_url ----------
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setMessage(null);

    if (!user) {
      setMessage({
        type: "error",
        text: "You must be signed in to save your profile.",
      });
      return;
    }

    if (!profile.username || profile.username.trim().length < 2) {
      setMessage({
        type: "error",
        text: "Username must be at least 2 characters.",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: profile.full_name ?? null,
        username: profile.username ?? null,
        bio: profile.bio ?? null,
        program_of_study: profile.program_of_study ?? null,
        graduation_year: profile.graduation_year ?? null,
        avatar_url: profile.avatar_url ?? null,
        student_type: profile.student_type ?? null,
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile((p) => ({ ...p, ...data }));
      
      // Invalidate React Query cache to update all components in real-time
      invalidateProfile(queryClient, user.id);
      queryClient.invalidateQueries({ queryKey: ["avatar"] });
      
      // Update cached profile in localStorage
      const { setCachedProfile } = await import("@/utils/storage");
      setCachedProfile(data);
      
      setMessage({ type: "success", text: "Profile saved successfully." });
      
      // Navigate to profile page after successful save
      setTimeout(() => {
        router.push("/profile");
      }, 1000);
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({
        type: "error",
        text: err?.message ?? "Unable to save profile.",
      });
    } finally {
      setLoading(false);
    }
  }

  // ---------- render ----------
  if (fetching) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="text-lg text-[var(--text-secondary)]">Loading profile…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 py-10 transition-colors">
      <form
        onSubmit={handleSubmit}
        className="max-w-xl w-full p-6 bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl shadow-sm border border-[var(--card-border)] transition-colors"
      >
        <h2 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">Edit profile</h2>

        {message && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              message.type === "error"
                ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Avatar UI */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-primary)] border border-[var(--card-border)] overflow-hidden flex items-center justify-center">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-sm text-[var(--text-secondary)]">No avatar</div>
            )}
          </div>

          <div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <span className="px-3 py-2 bg-[var(--color-accent)] text-white rounded text-sm hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition">
                Change avatar
              </span>
            </label>

            {profile.avatar_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="ml-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Remove
              </button>
            )}

            {uploadingAvatar && (
              <div className="text-xs text-[var(--text-secondary)] mt-2">Uploading…</div>
            )}
          </div>
        </div>

        {/* Full name */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">Full name</span>
          <input
            value={profile.full_name ?? ""}
            onChange={(e) =>
              setProfile((p) => ({ ...p, full_name: e.target.value }))
            }
            className="mt-1 block w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
            placeholder="John Doe"
          />
        </label>

        {/* Username */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">Username</span>
          <input
            value={profile.username ?? ""}
            onChange={(e) =>
              setProfile((p) => ({ ...p, username: e.target.value }))
            }
            className="mt-1 block w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
            placeholder="johndoe"
            required
          />
        </label>

        {/* Bio */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">Bio</span>
          <textarea
            value={profile.bio ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            className="mt-1 block w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
            placeholder="A little about you"
            rows={3}
          />
        </label>

        {/* Program */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">Program of study</span>
          <input
            value={profile.program_of_study ?? ""}
            onChange={(e) =>
              setProfile((p) => ({ ...p, program_of_study: e.target.value }))
            }
            className="mt-1 block w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
            placeholder="Computer Science"
          />
        </label>

        {/* Student Type */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)] mb-2 block">Student Type</span>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="student_type"
                value="Undergraduate"
                checked={profile.student_type === "Undergraduate"}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    student_type: e.target.value,
                  }))
                }
                className="w-4 h-4 text-[var(--color-accent)] bg-[var(--card-bg)] border-2 border-[var(--card-border)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-[var(--text-primary)]">Undergraduate</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="student_type"
                value="Graduate"
                checked={profile.student_type === "Graduate"}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    student_type: e.target.value,
                  }))
                }
                className="w-4 h-4 text-[var(--color-accent)] bg-[var(--card-bg)] border-2 border-[var(--card-border)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-[var(--text-primary)]">Graduate</span>
            </label>
          </div>
        </label>

        {/* Graduation year */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-[var(--text-primary)]">Graduation year</span>
          <input
            value={profile.graduation_year ?? ""}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                graduation_year:
                  e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            className="mt-1 block w-40 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
            placeholder="2026"
            type="number"
            min={1900}
            max={2100}
          />
        </label>

        {/* Actions */}
        <div className="flex gap-3 items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="px-4 py-2 border border-[var(--card-border)] rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>

          <div className="flex gap-3 items-center">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-[var(--color-accent)] text-white rounded shadow hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] disabled:opacity-60 transition"
            >
              {loading ? "Saving..." : "Save changes"}
            </button>

            <button
              type="button"
              onClick={() => {
                (async () => {
                  setMessage(null);
                  setFetching(true);
                  try {
                    if (!user) return;
                    const { data: profileData } = await supabase
                      .from("profiles")
                      .select(
                        "full_name, username, bio, program_of_study, graduation_year, avatar_url, student_type"
                      )
                      .eq("id", user.id)
                      .single();

                    setProfile({
                      full_name: profileData?.full_name ?? "",
                      username: profileData?.username ?? "",
                      bio: profileData?.bio ?? "",
                      program_of_study: profileData?.program_of_study ?? "",
                      graduation_year: profileData?.graduation_year ?? null,
                      avatar_url:
                        profileData?.avatar_url ??
                        "/images/avatar_placeholder.png",
                      student_type: profileData?.student_type ?? null,
                    });

                    setAvatarPreview(
                      profileData?.avatar_url ?? "/images/avatar_placeholder.png"
                    );
                  } catch (err) {
                    console.error("Reset fetch error:", err);
                    setMessage({
                      type: "error",
                      text: "Failed to reload profile.",
                    });
                  } finally {
                    setFetching(false);
                  }
                })();
              }}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}