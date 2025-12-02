"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    
    setDarkMode(isDark);
    applyTheme(isDark);
  }, []);

  const applyTheme = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleDarkModeToggle = (enabled: boolean) => {
    setDarkMode(enabled);
    applyTheme(enabled);
  };

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex justify-center px-4 transition-colors">
      <div className="w-full max-w-2xl">
        {/* Header Card */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] mb-6 overflow-hidden transition-colors">
          <div className="px-6 py-5 border-b border-[var(--card-border)] flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
              aria-label="Go back"
            >
              <svg
                className="w-5 h-5 text-[var(--text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Settings</h1>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Appearance Section */}
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--card-border)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Appearance</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)] mb-1">Dark Mode</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Switch between light and dark theme
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={(e) => handleDarkModeToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--card-border)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notifications</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)] mb-1">Push Notifications</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Receive notifications about new posts and activities
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)] mb-1">Email Notifications</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Get updates via email
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Account Section */}
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--card-border)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account</h2>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => router.push("/profileEditor")}
                className="w-full text-left px-4 py-3 rounded-lg border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[var(--text-primary)]"
              >
                <div className="font-medium">Edit Profile</div>
                <div className="text-sm text-[var(--text-secondary)]">Update your profile information</div>
              </button>
              <button
                onClick={() => router.push("/updatePassword")}
                className="w-full text-left px-4 py-3 rounded-lg border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[var(--text-primary)]"
              >
                <div className="font-medium">Change Password</div>
                <div className="text-sm text-[var(--text-secondary)]">Update your account password</div>
              </button>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--card-border)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Privacy</h2>
            </div>
            <div className="p-6 space-y-3">
              <button
                className="w-full text-left px-4 py-3 rounded-lg border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[var(--text-primary)]"
              >
                <div className="font-medium">Privacy Policy</div>
                <div className="text-sm text-[var(--text-secondary)]">View our privacy policy</div>
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-lg border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[var(--text-primary)]"
              >
                <div className="font-medium">Terms of Service</div>
                <div className="text-sm text-[var(--text-secondary)]">Read our terms of service</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

