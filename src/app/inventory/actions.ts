"use server";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const CONDITIONS = ["ok", "repair", "discard"];

async function editor() {
  const me = await requireMember();
  if (!me.memberId) throw new Error("not a member");
  return { me, supabase: await createClient() };
}

function rowFrom(fd: FormData, memberId: string) {
  const cond = String(fd.get("condition") ?? "ok");
  return {
    name_he: s(fd, "name_he") ?? "", category: s(fd, "category"), quantity: Number(fd.get("quantity") || 0), unit: s(fd, "unit") ?? "יח׳",
    location: s(fd, "location"), condition: CONDITIONS.includes(cond) ? cond : "ok", notes: s(fd, "notes"),
    updated_by: memberId, updated_at: new Date().toISOString(),
  };
}

export async function addItem(formData: FormData) {
  const { me, supabase } = await editor();
  const row = rowFrom(formData, me.memberId!);
  if (!row.name_he) throw new Error("שם פריט חובה");
  fail((await supabase.from("inventory_items").upsert(row, { onConflict: "camp_id,name_he" })).error);
  revalidatePath("/inventory");
}

export async function updateItem(formData: FormData) {
  const { me, supabase } = await editor();
  const row = rowFrom(formData, me.memberId!);
  if (!row.name_he) throw new Error("שם פריט חובה");
  fail((await supabase.from("inventory_items").update(row).eq("id", String(formData.get("id")))).error);
  revalidatePath("/inventory");
}

export async function deleteItem(formData: FormData) {
  const { supabase } = await editor();
  fail((await supabase.from("inventory_items").delete().eq("id", String(formData.get("id")))).error);
  revalidatePath("/inventory");
}

/** Import from the Excel template: header row in Hebrew (or the English keys); existing names are updated, new names added. */
export async function importItems(formData: FormData) {
  const { me, supabase } = await editor();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("לא נבחר קובץ");
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const pick = (r: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && String(v).trim() !== "") return String(v).trim(); } return null; };
  const condMap: Record<string, string> = { "תקין": "ok", "דורש תיקון": "repair", "לזרוק": "discard", ok: "ok", repair: "repair", discard: "discard" };
  const rows = raw.map((r) => ({
    name_he: pick(r, "פריט", "name_he", "name") ?? "",
    category: pick(r, "קטגוריה", "category"),
    quantity: Number(pick(r, "כמות", "quantity") ?? 1) || 0,
    unit: pick(r, "יחידה", "unit") ?? "יח׳",
    location: pick(r, "מיקום", "location"),
    condition: condMap[pick(r, "מצב", "condition") ?? "ok"] ?? "ok",
    notes: pick(r, "הערות", "notes"),
    updated_by: me.memberId!, updated_at: new Date().toISOString(),
  })).filter((r) => r.name_he);
  if (rows.length === 0) throw new Error("לא נמצאו שורות עם שם פריט (עמודה 'פריט')");
  // last occurrence of a duplicated name wins
  const byName = new Map(rows.map((r) => [r.name_he, r]));
  fail((await supabase.from("inventory_items").upsert(Array.from(byName.values()), { onConflict: "camp_id,name_he" })).error);
  revalidatePath("/inventory");
}
