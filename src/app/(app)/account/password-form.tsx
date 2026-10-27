"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm({ labels }: { labels: { pw: string; save: string; ok: string; err: string } }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pw = String(new FormData(form).get("pw") ?? "");
    const { error } = await createClient().auth.updateUser({ password: pw });
    setMsg(error ? `${labels.err}: ${error.message}` : labels.ok);
    if (!error) form.reset();
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="pw" type="password" minLength={8} required placeholder={labels.pw} className="input" autoComplete="new-password" />
      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn">{labels.save}</button>
    </form>
  );
}
