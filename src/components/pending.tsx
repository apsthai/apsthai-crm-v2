"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const clearButtons = () =>
  document.querySelectorAll(".is-busy").forEach((b) => {
    b.classList.remove("is-busy");
    (b as HTMLButtonElement).disabled = false;
  });

// Shows that something is happening: a bar at the top of the page while a link
// loads or a form is being saved, and a spinner on the button that was pressed.
// Busy belongs to the page it started on, so it ends by itself when a new page arrives.
export function PendingUI() {
  const key = `${usePathname()}?${useSearchParams()}`;
  const keyRef = useRef(key);
  const [busyAt, setBusyAt] = useState<string | null>(null);
  const busy = busyAt === key;

  useEffect(() => {
    keyRef.current = key;
    clearButtons();
  }, [key]);

  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      // wait a tick so the form data is read before the button is disabled
      setTimeout(() => {
        setBusyAt(keyRef.current);
        const btn = (e.submitter ?? (e.target as HTMLFormElement).querySelector("button")) as HTMLButtonElement | null;
        if (btn) { btn.classList.add("is-busy"); btn.disabled = true; }
      }, 0);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      setBusyAt(keyRef.current);
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  // a save that stays on the same page still ends: give up after 15 s at most
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => { setBusyAt(null); clearButtons(); }, 15000);
    return () => clearTimeout(t);
  }, [busy]);

  return busy ? <div className="pending-bar" aria-hidden /> : null;
}
