"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1️⃣ Get logged-in user
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr) {
          console.error("Auth getUser error:", authErr);
          if (!mounted) return;
          setErrorMsg("Error checking authentication.");
          setAuthChecked(true);
          return;
        }

        if (!user) {
          // For debugging it's nicer to show a sign-in CTA instead of forcing a router.push.
          // If you prefer immediate redirect, uncomment the next line:
          // router.push("/sign-in");
          if (!mounted) return;
          setAuthChecked(true);
          setLoading(false);
          setProfile(null);
          return;
        }

        const userId = user.id;
        console.log(user)

        // 2️⃣ Fetch user profile (check error)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, program_of_study, bio, avatar_url, graduation_year"
          )
          .eq("id", userId)
          .single();

        if (profileError) {
          console.warn("Profile fetch error or not found:", profileError);
          // It's okay if no profile yet — show 'Profile not found' UI
          if (!mounted) return;
          setProfile(null);
        } else {
          if (!mounted) return;
          setProfile(profileData ?? null);
        }

      

        if (mounted) setAuthChecked(true);
      } catch (err) {
        console.error("Unexpected load error:", err);
        if (mounted) setErrorMsg("Unexpected error loading profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  // quick debug UI to inspect state if something's failing
  if (loading) return <div className="p-10">Loading…</div>;

  // not authenticated flow (shows sign-in button)
  if (!authChecked || !profile) {
    // if authChecked true but profile null => show "profile not found" variant
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex justify-center items-start px-4 py-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-md overflow-hidden p-6">
          <h2 className="text-xl font-semibold mb-4">My Profile</h2>

          {errorMsg && <div className="mb-4 text-sm text-red-600">{errorMsg}</div>}

          {!authChecked && <div className="mb-4 text-sm">Checking authentication…</div>}

          {authChecked && !profile && (
            <>
              <div className="mb-4 text-sm">No profile found for the signed-in user.</div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/signin")}
                  className="px-4 py-2 bg-[#FF4136] text-white rounded"
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    // navigate to profile editor or signup flow
                    router.push("/profile/edit");
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Create profile
                </button>
              </div>
            </>
          )}

          {!authChecked && (
            <div className="mt-4 text-sm">
              If you expected to be signed in, check your session or open dev tools.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal authenticated + profile present render
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex justify-center text-black px-4 py-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-md overflow-hidden">
        {/* HEADER */}
        <div className="pt-4 px-4 pb-2 flex items-center gap-3">
          <span className="text-base text-black font-semibold">My Profile</span>
        </div>

        <div className="px-5 pb-4">
          {/* Avatar + Name */}
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-black overflow-hidden">
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="flex-1">
              <span className="font-semibold text-[16px]">
                {profile.full_name}
              </span>

              {profile.graduation_year && (
                <div className="text-xs text-slate-600">
                  🎓 {String(profile.graduation_year).slice(-2)}
                </div>
              )}

              <div className="text-xs text-slate-700 mt-1">
                {profile.program_of_study}
              </div>

              <div className="text-xs font-semibold text-slate-800 mt-1">
                {connectionsCount} campus connections
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-3 text-sm whitespace-pre-line">{profile.bio}</div>
          )}

          {/* Role Tag */}
          {profile.org_role && (
            <div className="mt-3 inline-flex px-3 py-1 rounded-full bg-black">
              <span className="text-xs text-white">{profile.org_role}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.push("/profileEditor")}
              className="flex-1 h-10 rounded-full bg-[#FF4136] text-white font-semibold"
            >
              Edit Profile
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="flex-1 h-10 rounded-full border border-slate-300 font-semibold"
            >
              Settings
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-5 border-t border-slate-200 -mx-5 px-5">
            <div className="flex justify-between text-sm font-medium pt-1">
              <button className="flex-1 text-center text-black pb-2 border-b-2 border-[#FF4136]">
                Posts
              </button>
              <button className="flex-1 text-center text-slate-400 pb-2">
                Activity
              </button>
              <button className="flex-1 text-center text-slate-400 pb-2">
                About
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
