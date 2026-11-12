"use client";

import { useActionState, useState } from "react";
import { Submit } from "@/components/submit";
import { type LoginState, manageLogin } from "./actions";

const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-navy hover:border-navy";

// The buttons for one person, and the new password shown once after create or reset.
export function LoginActions({ staffId, username, hasLogin, active, isMe }:
  { staffId: string; username: string; hasLogin: boolean; active: boolean; isMe: boolean }) {
  const [state, action] = useActionState<LoginState, FormData>(manageLogin, { error: null, password: null, done: null });
  const [copied, setCopied] = useState(false);

  // Close the popover as soon as its form is sent, so it does not cover the new password.
  const closePopover = (e: React.FormEvent<HTMLFormElement>) => e.currentTarget.closest("details")?.removeAttribute("open");

  const copy = async () => {
    try { await navigator.clipboard.writeText(`Username: ${username}\nPassword: ${state.password}`); setCopied(true); } catch { /* copy by hand */ }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {!hasLogin && (
          <form action={action}>
            <input type="hidden" name="staff_id" value={staffId} />
            <input type="hidden" name="action" value="create_login" />
            <Submit className="!px-3 !py-1.5 text-[13px]">Create login</Submit>
          </form>
        )}
        {hasLogin && active && (
          <details className="relative">
            <summary className={`${btn} cursor-pointer list-none`}>Reset password</summary>
            <form action={action} onSubmit={closePopover} className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
              <input type="hidden" name="staff_id" value={staffId} />
              <input type="hidden" name="action" value="reset_password" />
              <p className="text-slate-700">Make a new password for <b>{username}</b>? The old one stops working.</p>
              <Submit>Reset password</Submit>
            </form>
          </details>
        )}
        {hasLogin && !isMe && (
          <details className="relative">
            <summary className={`${btn} cursor-pointer list-none ${active ? "!text-slate-600" : ""}`}>{active ? "Switch off" : "Switch on"}</summary>
            <form action={action} onSubmit={closePopover} className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
              <input type="hidden" name="staff_id" value={staffId} />
              <input type="hidden" name="action" value="set_active" />
              <input type="hidden" name="active" value={active ? "0" : "1"} />
              <p className="text-slate-700">{active ? `${username} will not be able to sign in. Their cases and points stay.` : `${username} can sign in again.`}</p>
              <Submit variant={active ? "danger" : "primary"}>{active ? "Switch off" : "Switch on"}</Submit>
            </form>
          </details>
        )}
      </div>

      {state.error && <p role="alert" className="text-[13px] text-brand-red">{state.error}</p>}
      {state.done && !state.password && <p role="status" className="text-[13px] text-emerald-700">{state.done}.</p>}
      {state.password && (
        <div role="status" className="w-full max-w-xs rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-left text-[13px]">
          <p className="font-medium text-emerald-900">{state.done}. Send this to {username} now: it is shown only once.</p>
          <p className="mt-1.5 font-mono text-sm text-slate-900">Username: {username}<br />Password: {state.password}</p>
          <button type="button" onClick={copy} className={`${btn} mt-2`}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
    </div>
  );
}
