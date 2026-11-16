"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/fields";

type Partner = { id: string; name: string; default_share_pct: number | null };

// Admin only. Choosing a partner fills in their usual share, so it is never left blank (blank pays them nothing).
export function SubAgentFields({ partners, defaultId, defaultPct }:
  { partners: Partner[]; defaultId: string | null; defaultPct: number | null }) {
  const [id, setId] = useState(defaultId ?? "");
  const [pct, setPct] = useState(defaultPct != null ? String(defaultPct) : "");
  return (
    <div className="flex gap-2">
      <Field label="Sub-agent" className="flex-1">
        <select name="sub_agent_id" value={id} className={inputCls} onChange={(e) => {
          setId(e.target.value);
          const p = partners.find((x) => x.id === e.target.value);
          setPct(p ? String(Number(p.default_share_pct ?? 0)) : "");
        }}>
          <option value="">-</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Share %" className="w-24">
        <input name="sub_agent_pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} disabled={!id}
          required={!!id} className={inputCls} />
      </Field>
    </div>
  );
}
