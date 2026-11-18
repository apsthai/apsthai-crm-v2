"use client";

import { useEffect } from "react";

// For a viewer: every form that saves something is shown but cannot be used. Its fields are disabled and its
// buttons hidden. Forms that only navigate (a plain link as action, method GET) keep working. The database refuses a
// viewer's changes anyway; this only keeps the screen honest. Buttons that only start an edit carry data-edit and are
// hidden by CSS (globals.css).
export function ReadOnlyGuard() {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const lock = () => {
      for (const f of main.querySelectorAll("form")) {
        const action = f.getAttribute("action") ?? "";
        const navigates = action.startsWith("/") && (f.getAttribute("method") ?? "get").toLowerCase() === "get";
        if (navigates || f.dataset.locked) continue;
        f.dataset.locked = "1";
        f.addEventListener("submit", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
        for (const el of f.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) el.disabled = true;
        for (const b of f.querySelectorAll<HTMLButtonElement>("button")) if (b.type !== "button") b.style.display = "none";
      }
    };
    lock();
    // Edit boxes open later (popovers, panels), so keep watching.
    const obs = new MutationObserver(lock);
    obs.observe(main, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
