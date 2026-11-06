"use client";

import { useFormStatus } from "react-dom";

// A submit button that shows a spinner and blocks double clicks while the form is saving.
export function Submit({ children, className = "", variant = "primary", name, value }:
  { children: React.ReactNode; className?: string; variant?: "primary" | "ghost" | "danger"; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const look = variant === "primary"
    ? "bg-navy text-white hover:bg-navy-dark border-transparent"
    : variant === "danger"
      ? "bg-white text-brand-red border-red-300 hover:bg-red-50"
      : "bg-white text-navy border-slate-300 hover:border-navy";
  return (
    <button type="submit" name={name} value={value} disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${look} ${className}`}>
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
      {children}
    </button>
  );
}
