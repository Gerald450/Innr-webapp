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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Set New Password
        </h2>

        {message && (
          <p className="mb-4 text-center text-sm text-gray-700">{message}</p>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              New Password
            </label>
            <input
              type="password"
              id="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none"
              placeholder="Enter new password"
              style={{
                outlineColor: "#ff4136",
                boxShadow: "0 0 0 2px #ff4136",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2 rounded-lg disabled:opacity-50"
            style={{
              backgroundColor: "#ff4136",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#e03a2c")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#ff4136")
            }
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Remembered your password?{" "}
          <a
            href="/signin"
            style={{ color: "#ff4136" }}
            className="hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
