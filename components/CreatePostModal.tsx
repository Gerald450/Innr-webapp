"use client";
import React, { useEffect, useRef, useState } from "react";

type CreatePostModalProps = {
  initialName?: string;
  initialGradYear?: string;
  onClose: () => void;
  onSubmit: (post: {
    id: number;
    name: string;
    text: string;
    time: string;
    gradYear: string;
    image: string;
  }) => void;
};

export default function CreatePostModal({
  initialName = "Gerald Shimo",
  initialGradYear = "27",
  onClose,
  onSubmit,
}: CreatePostModalProps) {
  const [name, setName] = useState(initialName);
  const [gradYear, setGradYear] = useState(initialGradYear);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
  }

  function handleSubmit() {
    if (!text.trim()) return; // don't submit empty posts
    const newPost = {
      id: Date.now(),
      name,
      text: text.trim(),
      time: "just now",
      gradYear,
      image: imagePreview || "",
    };
    onSubmit(newPost);
    // reset local state and close
    setText("");
    setImageFile(null);
    setImagePreview("");
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-3 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-1/2 rounded-md border px-3 py-1 text-sm"
                placeholder="Your name"
              />
              <input
                value={gradYear}
                onChange={(e) => setGradYear(e.target.value)}
                className="w-1/4 rounded-md border px-3 py-1 text-sm"
                placeholder="Grad year"
              />
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="What's happening on campus?"
              className="w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 rounded-full px-2 py-1 text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {imagePreview ? (
          <div className="mt-4 flex items-center gap-3">
            <img src={imagePreview} alt="preview" className="max-h-32 rounded-md" />
            <button
              onClick={() => {
                setImageFile(null);
                setImagePreview("");
              }}
              className="text-sm text-red-600"
            >
              Remove
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100">
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <span className="text-sm text-gray-600">Attach image</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
