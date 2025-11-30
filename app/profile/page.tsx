"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 1️⃣ Get logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const userId = user.id;

      // 2️⃣ Fetch user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "id, full_name, program_of_study, bio, avatar_url, graduation_year, org_role"
        )
        .eq("id", userId)
        .single();

      setProfile(profileData);

      // 3️⃣ Fetch campus connections count
      const count = 0

      setConnectionsCount(count ?? 0);

      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <div className="p-10">Loading…</div>;
  if (!profile) return <div className="p-10">Profile not found.</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex justify-center px-4 py-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-md overflow-hidden">
        {/* HEADER */}
        <div className="pt-4 px-4 pb-2 flex items-center gap-3">
          <span className="text-base font-semibold">My Profile</span>
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
            <button className="flex-1 h-10 rounded-full bg-[#FF4136] text-white font-semibold">
              Edit Profile
            </button>
            <button className="flex-1 h-10 rounded-full border border-slate-300 font-semibold">
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
