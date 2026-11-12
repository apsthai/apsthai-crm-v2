"use client";

import { useState } from "react";

// Our own day / month / year pickers, so every phone shows Christian-era years (the phone's own
// date picker follows its calendar setting and can show Buddhist-era years). The value is an ISO date.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sel = "rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none transition focus:border-navy focus:ring-3 focus:ring-navy/15";
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function years(around: number, extra?: number) {
  const list = Array.from({ length: 9 }, (_, i) => around - 3 + i);
  if (extra && !list.includes(extra)) list.push(extra);
  return list.sort((a, b) => a - b);
}

// Day, month and year. `defaultValue` is "YYYY-MM-DD".
export function DatePick({ name, defaultValue, label = "Date", className = "" }:
  { name: string; defaultValue: string; label?: string; className?: string }) {
  const [y0, m0, d0] = defaultValue.split("-").map(Number);
  const [y, setY] = useState(y0);
  const [m, setM] = useState(m0);
  const [d, setD] = useState(d0);
  const day = Math.min(d, daysIn(y, m));
  return (
    <span role="group" aria-label={label} className={`inline-flex gap-1 ${className}`}>
      <input type="hidden" name={name} value={`${y}-${pad(m)}-${pad(day)}`} />
      <select aria-label={`${label}: day`} value={day} onChange={(e) => setD(Number(e.target.value))} className={sel}>
        {Array.from({ length: daysIn(y, m) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select aria-label={`${label}: month`} value={m} onChange={(e) => setM(Number(e.target.value))} className={sel}>
        {MONTHS.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
      </select>
      <select aria-label={`${label}: year`} value={y} onChange={(e) => setY(Number(e.target.value))} className={sel}>
        {years(y0).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </span>
  );
}

// Month and year. The value is "YYYY-MM" ("" when not chosen). Works with or without value/onChange.
export function MonthPick({ name, defaultValue = "", value, onChange, label = "Month", around, required, className = "" }:
  { name: string; defaultValue?: string; value?: string; onChange?: (v: string) => void; label?: string;
    around: number; required?: boolean; className?: string }) {
  const [own, setOwn] = useState(defaultValue);
  const v = value ?? own;
  const [yy, mm] = v ? v.split("-").map(Number) : [0, 0];
  const set = (y: number, m: number) => {
    const next = y && m ? `${y}-${pad(m)}` : y ? `${y}-` : m ? `-${pad(m)}` : "";
    if (onChange) onChange(next); else setOwn(next);
  };
  const full = yy > 0 && mm > 0;
  return (
    <span role="group" aria-label={label} className={`flex gap-1 ${className}`}>
      <input type="hidden" name={name} value={full ? `${yy}-${pad(mm)}` : ""} />
      <select aria-label={`${label}: month`} value={mm || ""} required={required} onChange={(e) => set(yy, Number(e.target.value))} className={`${sel} flex-1`}>
        <option value="">Month</option>
        {MONTHS.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
      </select>
      <select aria-label={`${label}: year`} value={yy || ""} required={required} onChange={(e) => set(Number(e.target.value), mm)} className={`${sel} flex-1`}>
        <option value="">Year</option>
        {years(around, yy || undefined).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </span>
  );
}
