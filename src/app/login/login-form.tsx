"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailForUsername } from "@/lib/supabase/config";

export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [error, setError] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!username || !password) return setError("Please enter your username and password.");
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email: emailForUsername(username), password });
    if (error) {
      setBusy(false);
      setError(error.status === 400 ? "Incorrect username or password." : "Could not sign in. Please try again.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] outline-none transition focus:border-navy focus:ring-3 focus:ring-navy/15" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password"
            className="block w-full rounded-lg border border-slate-300 py-2.5 pr-16 pl-3 text-[15px] outline-none transition focus:border-navy focus:ring-3 focus:ring-navy/15" />
          <button type="button" onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-navy">
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}
      <button type="submit" disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-navy-dark disabled:opacity-70">
        {busy && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-500">Forgot your password? Please contact Admin.</p>
    </form>
  );
}
