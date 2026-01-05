"use client";
import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { clearAllUserCache } from "@/utils/cacheInvalidation";
import { clearUserCache } from "@/utils/storage";

type Mode = "signin" | "signup";

export default function AuthPageSupabase() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const redirectUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const rawNext = searchParams.get("next") || "/";
  const nextPath = (() => {
    try {
      return decodeURIComponent(rawNext);
    } catch {
      return "/";
    }
  })();

  const pwScore = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email";
    if (mode === "signup") {
      if (fullName.trim().length < 2) e.fullName = "Enter your full name";
      if (username.trim().length < 2) e.username = "Enter a username";
    }
    if (password.length < 8)
      e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    setStatusMsg(null);
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, username },
            emailRedirectTo: `${redirectUrl}/`,
          },
        });

        if (error) throw error;

        setStatusMsg("Account created! Check your email for confirmation");
      } else {
        // SIGN IN path — changed to capture tokens and set cookies server-side
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // tokens from Supabase session (if present)
        const access = (data as any)?.session?.access_token;
        const refresh = (data as any)?.session?.refresh_token;

        if (access && refresh) {
          // POST tokens to server route which sets httpOnly cookies
          try {
            const resp = await fetch("/api/auth/setCookie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access, refresh }),
            });

            if (!resp.ok) {
              // if server failed to set cookies, surface message but still fallback to push
              const txt = await resp.text();
              console.error("Failed to set auth cookies:", txt);
              setStatusMsg(
                "Signed in, but failed to persist session on server."
              );
              // Clear cache before redirect
              clearAllUserCache(queryClient);
              clearUserCache();
              // fallback: still navigate to requested page
              router.push(nextPath || "/");
              return;
            }

            // Clear React Query cache and localStorage before redirect
            clearAllUserCache(queryClient);
            clearUserCache();
            
            setStatusMsg("Signed in successfully!");
            // navigate to requested page (middleware will now see cookies)
            router.push(nextPath || "/");
            return;
          } catch (err) {
            console.error("Error posting tokens to server:", err);
            setStatusMsg("Signed in, but server cookie step failed.");
            // Clear cache before redirect
            clearAllUserCache(queryClient);
            clearUserCache();
            router.push(nextPath || "/");
            return;
          }
        }

        // If tokens absent (unexpected), just proceed to home as a fallback
        // Clear cache before redirect
        clearAllUserCache(queryClient);
        clearUserCache();
        setStatusMsg("Signed in successfully!");
        router.push("/");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrors({ general: err.message ?? "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    setLoading(true);
    setErrors({});
    setStatusMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErrors({ email: "Enter a valid email to reset password" });
      setLoading(false);
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectUrl}/updatePassword/`,
      });
      if (error) throw error;
      setStatusMsg("If an account exists, a reset email has been sent.");
    } catch (err: any) {
      console.error("Reset error:", err);
      setErrors({ general: err.message ?? "Unable to send reset email" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center text-[var(--text-primary)] justify-center px-4 transition-colors">
      <div className="w-full max-w-6xl flex flex-col md:flex-row md:items-center md:justify-between gap-10">
        <div className="flex-1">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--color-accent)]">
            Innr
          </h1>
          <p className="mt-4 text-xl text-[var(--text-primary)] max-w-md">
            Connect with your campus and the people around you on Innr.
          </p>
        </div>

        <div className="flex-1 max-w-md">
          <div className="bg-[var(--card-bg)] shadow-lg rounded-xl overflow-hidden border border-[var(--card-border)] transition-colors">
            <main className="p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {mode === "signin" ? "Sign in" : "Create account"}
                </h2>
                <div className="text-sm text-[var(--text-secondary)]">
                  {mode === "signin" ? "New here?" : "Already a member?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "signin" ? "signup" : "signin");
                      setErrors({});
                      setStatusMsg(null);
                    }}
                    className="text-[var(--color-accent)] hover:underline font-medium"
                  >
                    {mode === "signin" ? "Create account" : "Sign in"}
                  </button>
                </div>
              </div>

              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Use your email to{" "}
                {mode === "signin" ? "sign in" : "create an account"}
              </p>

              <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
                {errors.general && (
                  <div className="text-sm text-red-600 dark:text-red-400">{errors.general}</div>
                )}
                {statusMsg && (
                  <div className="text-sm text-green-700 dark:text-green-400">{statusMsg}</div>
                )}

                {mode === "signup" && (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        Full name
                      </span>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={`mt-1 block w-full rounded-md border bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors ${
                          errors.fullName
                            ? "border-red-400"
                            : "border-[var(--card-border)]"
                        }`}
                        placeholder="Jane Doe"
                      />
                      {errors.fullName && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {errors.fullName}
                        </div>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        Username
                      </span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`mt-1 block w-full rounded-md border bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors ${
                          errors.username
                            ? "border-red-400"
                            : "border-[var(--card-border)]"
                        }`}
                        placeholder="janedoe"
                      />
                      {errors.username && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {errors.username}
                        </div>
                      )}
                    </label>
                  </>
                )}

                <label className="block">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Email address
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1 block w-full rounded-md border bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors ${
                      errors.email ? "border-red-400" : "border-[var(--card-border)]"
                    }`}
                    placeholder="you@university.edu"
                  />
                  {errors.email && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {errors.email}
                    </div>
                  )}
                </label>

                <label className="block relative">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Password
                  </span>
                  <div className="mt-1 flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`flex-1 rounded-md border bg-[var(--card-bg)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors ${
                        errors.password ? "border-red-400" : "border-[var(--card-border)]"
                      }`}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="ml-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {errors.password && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {errors.password}
                    </div>
                  )}
                </label>

                {mode == "signin" && (
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center text-sm gap-2">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={() => setRemember((r) => !r)}
                        className="rounded border-[var(--card-border)]"
                      />
                      <span className="text-[var(--text-secondary)]">Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={sendPasswordReset}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] text-white px-4 py-2 font-medium shadow hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] disabled:opacity-60 transition"
                  >
                    {loading
                      ? "Working..."
                      : mode === "signin"
                      ? "Sign in"
                      : "Create account"}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center text-sm text-[var(--text-secondary)]">
                By continuing you agree to our{" "}
                <button className="text-[var(--color-accent)] hover:underline">
                  Terms
                </button>{" "}
                and{" "}
                <button className="text-[var(--color-accent)] hover:underline">
                  Privacy Policy
                </button>
                .
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
