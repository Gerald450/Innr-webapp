"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // <- update path if needed

type Mode = "signin" | "signup";

export default function AuthPageSupabase() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pwScore = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email";
    if (mode === "signup" && name.trim().length < 2) e.name = "Enter your name";
    if (password.length < 8) e.password = "Password must be at least 8 characters";
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
        // Supabase signUp with additional user metadata
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
            // you can add redirectTo for email confirmations if desired:
            // emailRedirectTo: "https://yourapp.com/welcome"
          },
        });

        if (error) throw error;

        // Supabase often sends confirmation email (depending on settings)
        setStatusMsg("Check your email for a confirmation link (if enabled).");
        // Optionally redirect to a 'check your email' page:
        // router.push("/check-email");
      } else {
        // Sign in with email/password
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // data contains user and session
        // session.access_token is JWT, but supabase client stores session automatically
        setStatusMsg("Signed in successfully");
        // If you want to persist session longer when 'remember' is checked, Supabase saves session in local storage by default.
        // Redirect to dashboard / protected route:
        router.push("/"); // change path as needed
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrors({ general: err.message ?? "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    setLoading(true);
    setErrors({});
    setStatusMsg(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any, // 'google' | 'github' | 'apple' ...
        options: {
          redirectTo: `${window.location.origin}/auth/callback`, // change if you have a dedicated callback
        },
      });
      if (error) throw error;
      // For OAuth, Supabase will redirect the browser — you usually don't need to handle the response here.
      setStatusMsg("Redirecting to provider...");
    } catch (err: any) {
      console.error("OAuth error:", err);
      setErrors({ general: err.message ?? "OAuth error" });
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
        redirectTo: `${window.location.origin}/reset-password`, // route where you handle the password-reset flow
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-6 text-black">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl overflow-hidden">
        <main className="p-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
            <div className="text-sm text-slate-500">
              {mode === "signin" ? "New here?" : "Already a member?"}{" "}
              <button
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrors({}); setStatusMsg(null); }}
                className="text-indigo-600 hover:underline font-medium"
                aria-label="Switch authentication mode"
              >
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-500">Use your email to {mode === "signin" ? "sign in" : "create an account"} or continue with:</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 border rounded-md px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => handleOAuth("google")}
              aria-label="Sign in with Google"
            >
              Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 border rounded-md px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => handleOAuth("github")}
              aria-label="Sign in with GitHub"
            >
              GitHub
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            {errors.general && <div className="text-sm text-red-600">{errors.general}</div>}
            {statusMsg && <div className="text-sm text-green-700">{statusMsg}</div>}

            {mode === "signup" && (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Full name</span>
                <input
                  aria-invalid={!!errors.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${errors.name ? "border-red-400" : "border-slate-200"}`}
                  placeholder="Jane Doe"
                />
                {errors.name && <div className="mt-1 text-xs text-red-600">{errors.name}</div>}
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email address</span>
              <input
                type="email"
                aria-invalid={!!errors.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${errors.email ? "border-red-400" : "border-slate-200"}`}
                placeholder="you@domain.com"
              />
              {errors.email && <div className="mt-1 text-xs text-red-600">{errors.email}</div>}
            </label>

            <label className="block relative">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <div className="mt-1 flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  aria-invalid={!!errors.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`flex-1 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${errors.password ? "border-red-400" : "border-slate-200"}`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="ml-2 text-sm text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <div className="mt-1 text-xs text-red-600">{errors.password}</div>}

              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div
                    aria-hidden
                    className={`h-2 transition-all ${pwScore(password) >= 1 ? "w-[25%]" : "w-[4%]"} ${pwScore(password) >= 4 ? "bg-green-500" : pwScore(password) >= 2 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${(pwScore(password) / 4) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 w-28 text-right">
                  {password.length === 0 ? "—" : (["Weak", "Okay", "Good", "Strong"][Math.max(0, pwScore(password)-1)] ?? "Weak")}
                </div>
              </div>
            </label>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center text-sm gap-2">
                <input type="checkbox" checked={remember} onChange={() => setRemember(r => !r)} className="rounded border-slate-300" />
                <span className="text-slate-600">Remember me</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendPasswordReset}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-4 py-2 font-medium shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </div>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            By continuing you agree to our <button className="text-indigo-600 hover:underline">Terms</button> and <button className="text-indigo-600 hover:underline">Privacy Policy</button>.
          </div>
        </main>
      </div>
    </div>
  );
}
