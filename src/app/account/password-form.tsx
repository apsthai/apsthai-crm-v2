"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/fields";
import { createClient } from "@/lib/supabase/client";

// Checks the current password first, then sets the new one. Nothing about the passwords is logged or stored here.
export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const again = String(fd.get("again") ?? "");
    if (next.length < 8) return setMsg({ ok: false, text: "The new password needs at least 8 characters." });
    if (next !== again) return setMsg({ ok: false, text: "The two new passwords are not the same." });
    if (next === current) return setMsg({ ok: false, text: "The new password is the same as the current one." });
    setBusy(true); setMsg(null);
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    const email = u.user?.email;
    if (!email) { setBusy(false); return setMsg({ ok: false, text: "Please sign in again." }); }
    const check = await sb.auth.signInWithPassword({ email, password: current });
    if (check.error) { setBusy(false); return setMsg({ ok: false, text: "The current password is not right." }); }
    const { error } = await sb.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    form.reset();
    setMsg({ ok: true, text: "Password changed. Use the new one next time you sign in." });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Current password"><input name="current" type="password" autoComplete="current-password" required className={inputCls} /></Field>
      <Field label="New password"><input name="next" type="password" autoComplete="new-password" required minLength={8} className={inputCls} /></Field>
      <Field label="New password again"><input name="again" type="password" autoComplete="new-password" required minLength={8} className={inputCls} /></Field>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-brand-red"}`}>{msg.text}</p>}
      <button type="submit" disabled={busy}
        className="self-start rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60">
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
