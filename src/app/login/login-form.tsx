"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailForUsername } from "@/lib/supabase/config";

export function LoginForm({ labels }: { labels: Record<"username" | "password" | "login" | "failed", string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(false);
    const { error } = await createClient().auth.signInWithPassword({
      email: emailForUsername(String(fd.get("username") ?? "")),
      password: String(fd.get("password") ?? ""),
    });
    setBusy(false);
    if (error) return setError(true);
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block"><span className="label">{labels.username}</span>
        <input name="username" className="input" autoComplete="username" autoCapitalize="none" required /></label>
      <label className="block"><span className="label">{labels.password}</span>
        <input name="password" type="password" className="input" autoComplete="current-password" required /></label>
      {error && <p className="text-sm text-red-700">{labels.failed}</p>}
      <button className="btn w-full" disabled={busy}>{labels.login}</button>
    </form>
  );
}
