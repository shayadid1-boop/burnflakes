"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

// Who may write is decided by the database (row security: the department's lead or an admin);
// these actions only shape the input and send the person back to the page they were on.

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
const num = (v: FormDataEntryValue | null) => Math.max(0, Number(v ?? 0) || 0);
const backOf = (fd: FormData) => {
  const b = String(fd.get("back") ?? "/me");
  return b.startsWith("/") ? b : "/me";
};

/** How many shifts the list is planned for. */
export async function setShoppingShifts(fd: FormData) {
  const me = await requireMember();
  if (!me.eventId) throw new Error("no current event");
  const supabase = await createClient();
  fail((await supabase.from("shopping_plans").upsert({
    event_id: me.eventId,
    department_id: String(fd.get("department_id")),
    shift_count: Math.min(30, Math.round(num(fd.get("shift_count")))),
    updated_at: new Date().toISOString(),
  })).error);
  const back = backOf(fd); revalidatePath(back); redirect(back);
}

/** Change one item: how much a shift uses, what is already in the store, what it costs. */
export async function updateShoppingItem(fd: FormData) {
  await requireMember();
  const supabase = await createClient();
  fail((await supabase.from("shopping_items").update({
    per_shift: num(fd.get("per_shift")),
    in_stock: Math.round(num(fd.get("in_stock"))),
    unit_price: num(fd.get("unit_price")),
  }).eq("id", String(fd.get("id")))).error);
  const back = backOf(fd); revalidatePath(back); redirect(back);
}

export async function addShoppingItem(fd: FormData) {
  const me = await requireMember();
  if (!me.eventId) throw new Error("no current event");
  const name = String(fd.get("name_he") ?? "").trim();
  if (!name) throw new Error("צריך שם מוצר");
  const supabase = await createClient();
  fail((await supabase.from("shopping_items").insert({
    event_id: me.eventId,
    department_id: String(fd.get("department_id")),
    name_he: name,
    unit_he: String(fd.get("unit_he") ?? "").trim() || "יח׳",
    per_shift: num(fd.get("per_shift")),
    in_stock: Math.round(num(fd.get("in_stock"))),
    unit_price: num(fd.get("unit_price")),
    budget_line: String(fd.get("budget_line") ?? "") || null,
    sort_order: 999,
  })).error);
  const back = backOf(fd); revalidatePath(back); redirect(back);
}

export async function deleteShoppingItem(fd: FormData) {
  await requireMember();
  const supabase = await createClient();
  fail((await supabase.from("shopping_items").delete().eq("id", String(fd.get("id")))).error);
  const back = backOf(fd); revalidatePath(back); redirect(back);
}
