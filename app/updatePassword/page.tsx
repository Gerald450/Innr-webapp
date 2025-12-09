// app/updatePassword/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully. Redirecting to signin...");
      setTimeout(() => router.push("/signin"), 3000);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 py-10 transition-colors">
      <div className="max-w-md w-full bg-[var(--card-bg)] p-8 rounded-xl shadow-lg border border-[var(--card-border)] transition-colors">
        <h2 className="text-2xl font-bold mb-6 text-center text-[var(--text-primary)]">
          Set New Password
        </h2>

        {message && (
          <p className={`mb-4 text-center text-sm ${
            message.includes("successfully") 
              ? "text-green-700 dark:text-green-400" 
              : "text-red-700 dark:text-red-400"
          }`}>
            {message}
          </p>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-primary)]"
            >
              New Password
            </label>
            <input
              type="password"
              id="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[var(--card-border)] rounded-lg bg-[var(--card-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
              placeholder="Enter new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2 rounded-lg disabled:opacity-50 bg-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Remembered your password?{" "}
          <a
            href="/signin"
            className="text-[var(--color-accent)] hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
