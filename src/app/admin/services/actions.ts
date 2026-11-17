"use server";

import { adminDb, back, num, s } from "../shared";

const go = (id: string | null, e?: string | { message: string } | null) => back(`/admin/services${id ? `?open=${id}` : ""}`, e);

// A new service starts with a copy of another service's stages, so it can be used straight away.
export async function addService(fd: FormData) {
  const sb = await adminDb();
  const name = s(fd, "name_en");
  if (!name) return go(null, "Enter the service name");
  const { data: last } = await sb.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const c = await sb.from("categories").insert({
    name_en: name, name_th: s(fd, "name_th") ?? name, points: num(fd, "points"), estimated_value_thb: num(fd, "estimated_value_thb"),
    in_house: fd.get("in_house") === "yes", sort_order: (last?.[0]?.sort_order ?? 0) + 1, active: true,
  }).select("id").single();
  if (c.error) return go(null, c.error.message.includes("unique") ? "A service with this name already exists" : c.error);
  const from = s(fd, "copy_from");
  if (from) {
    const { data: st } = await sb.from("stages").select("name_en, name_th, sort_order, level, milestone, probability_pct, editable_by_team_id")
      .eq("category_id", from).eq("active", true).order("sort_order");
    if (st?.length) {
      const ins = await sb.from("stages").insert(st.map((x) => ({ ...x, category_id: c.data.id })));
      if (ins.error) return go(c.data.id, ins.error);
    }
  }
  go(c.data.id);
}

export async function saveService(fd: FormData) {
  const sb = await adminDb();
  const id = s(fd, "id")!;
  if (!s(fd, "name_en")) return go(id, "Enter the service name");
  const up = await sb.from("categories").update({
    name_en: s(fd, "name_en"), name_th: s(fd, "name_th"), points: num(fd, "points"), estimated_value_thb: num(fd, "estimated_value_thb"),
    in_house: fd.get("in_house") === "yes", active: fd.get("active") !== "no",
  }).eq("id", id);
  if (up.error) return go(id, up.error.message.includes("unique") ? "A service with this name already exists" : up.error);

  const stageIds = String(fd.get("stages") ?? "").split(",").filter(Boolean);
  const success = s(fd, "success_stage");
  for (const sid of stageIds) {
    const prob = num(fd, `prob_${sid}`);
    if (!s(fd, `name_${sid}`)) return go(id, "Every stage needs a name");
    if (prob == null || prob < 0 || prob > 100) return go(id, "Chance of closing is 0 to 100");
    const r = await sb.from("stages").update({
      name_en: s(fd, `name_${sid}`), probability_pct: prob, milestone: sid === success ? "success" : "none",
      editable_by_team_id: s(fd, `team_${sid}`), active: fd.get(`shown_${sid}`) === "1",
    }).eq("id", sid);
    if (r.error) return go(id, r.error.message.includes("unique") ? "Two stages have the same name" : r.error);
  }
  const newName = s(fd, "new_stage");
  if (newName) {
    const { data: last } = await sb.from("stages").select("sort_order").eq("category_id", id).order("sort_order", { ascending: false }).limit(1);
    const r = await sb.from("stages").insert({
      category_id: id, name_en: newName, name_th: newName, sort_order: (last?.[0]?.sort_order ?? 0) + 1,
      level: s(fd, "new_level") ?? "case", milestone: "none", probability_pct: num(fd, "new_prob") ?? 0,
    });
    if (r.error) return go(id, r.error.message.includes("unique") ? "That stage name is already used" : r.error);
  }
  go(id);
}

// Swap with the neighbour above or below.
async function move(table: "categories" | "stages", id: string, dir: string, scope?: { col: string; val: string }) {
  const sb = await adminDb();
  let q = sb.from(table).select("id, sort_order").order("sort_order");
  if (scope) q = q.eq(scope.col, scope.val);
  const { data } = await q;
  const list = data ?? [];
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return null;
  const a = list[i], b = list[j];
  // Two steps through a free number, in case the order has to be unique.
  const r1 = await sb.from(table).update({ sort_order: -1 }).eq("id", a.id);
  const r2 = await sb.from(table).update({ sort_order: a.sort_order }).eq("id", b.id);
  const r3 = await sb.from(table).update({ sort_order: b.sort_order }).eq("id", a.id);
  return r1.error ?? r2.error ?? r3.error;
}

export async function moveService(fd: FormData) {
  const e = await move("categories", s(fd, "id")!, s(fd, "dir")!);
  go(null, e);
}

// Sent by the arrow buttons inside the service form: move = "<stage id>:up" or ":down".
export async function moveStage(fd: FormData) {
  const cat = s(fd, "id")!;
  const [sid, dir] = String(fd.get("move") ?? "").split(":");
  const e = await move("stages", sid, dir, { col: "category_id", val: cat });
  go(cat, e);
}
