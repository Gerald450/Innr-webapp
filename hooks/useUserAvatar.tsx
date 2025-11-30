"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUserAvatar() {
  const [avatar, setAvatar] = useState<string>("/images/avatar_placeholder.png");

  useEffect(() => {
    const loadAvatar = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) return;

      const metaAvatar = user.user_metadata?.avatar_url;

      if (metaAvatar) {
        setAvatar(metaAvatar);
      }
    };

    loadAvatar();
  }, []);

  return avatar;
}
