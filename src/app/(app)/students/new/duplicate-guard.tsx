"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Hit = { id: string; codename: string; firstname: string | null; lastname: string | null; dob: string | null; matched_on: string };

// Checks for possible duplicates before the form is sent to the server.
export function DuplicateGuard({ action, labels, children }: {
  action: (fd: FormData) => Promise<void>;
  labels: { found: string; anyway: string; create: string; matched: string };
  children: React.ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const checked = useRef(false);

  async function check(e: React.FormEvent<HTMLFormElement>) {
    if (checked.current) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => (String(fd.get(k) ?? "").trim() || null);
    const { data } = await createClient().rpc("find_similar_students", {
      p_firstname: v("firstname"), p_lastname: v("lastname"), p_dob: v("dob"), p_phone: v("phone"),
    });
    const found = (data ?? []) as Hit[];
    checked.current = true;
    if (found.length === 0) form.current?.requestSubmit();
    else setHits(found);
  }

  return (
    <form ref={form} action={action} onSubmit={check}>
      {children}
      {hits && hits.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-2 font-medium text-amber-900">{labels.found}</p>
          <ul className="mb-3 list-disc pl-5">
            {hits.map((h) => (
              <li key={h.id}>
                <Link href={`/students/${h.id}`} className="link" target="_blank">{h.codename}</Link>{" "}
                {h.firstname} {h.lastname} {h.dob ?? ""} <span className="text-amber-800">({labels.matched}: {h.matched_on})</span>
              </li>
            ))}
          </ul>
          <button className="btn">{labels.anyway}</button>
        </div>
      )}
      {!hits?.length && <div className="mt-5"><button className="btn">{labels.create}</button></div>}
    </form>
  );
}
