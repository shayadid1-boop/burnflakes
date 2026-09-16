"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

async function myEventMemberId() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("event_members").select("id, attending").eq("event_id", me.eventId!).eq("member_id", me.memberId!).maybeSingle();
  if (!data?.attending) throw new Error("only attending members");
  return { supabase, emId: data.id };
}

export async function registerShift(formData: FormData) {
  const { supabase, emId } = await myEventMemberId();
  const shiftId = String(formData.get("shift_id"));
  const { data: s } = await supabase.from("shifts").select("slots").eq("id", shiftId).single();
  const { count } = await supabase.from("shift_assignments").select("*", { count: "exact", head: true }).eq("shift_id", shiftId);
  if (s && (count ?? 0) >= s.slots) throw new Error("המשמרת מלאה");
  const { error } = await supabase.from("shift_assignments").insert({ shift_id: shiftId, event_member_id: emId });
  fail(error);
  revalidatePath(String(formData.get("back") || "/shifts")); revalidatePath("/me");
}

export async function unregisterShift(formData: FormData) {
  const { supabase, emId } = await myEventMemberId();
  const { error } = await supabase.from("shift_assignments").delete().eq("shift_id", String(formData.get("shift_id"))).eq("event_member_id", emId);
  fail(error);
  revalidatePath(String(formData.get("back") || "/shifts")); revalidatePath("/me");
}

// ---------- department lead / admin ----------
async function lead() {
  const me = await requireMember();
  if (!me.eventId) throw new Error("no event");
  return { me, supabase: await createClient() };
}

/** Add a shift type to a department: a name and how many people it takes. That is the whole definition. */
export async function createShiftType(formData: FormData) {
  const { me, supabase } = await lead();
  const name = String(formData.get("name_he") ?? "").trim();
  if (!name) throw new Error("צריך שם למשמרת");
  const { error } = await supabase.from("shift_roles").insert({
    event_id: me.eventId, department_id: String(formData.get("department_id")), name_he: name,
    description_he: String(formData.get("description_he") ?? "").trim() || null,
    slots_per_shift: Math.max(1, Number(formData.get("slots_per_shift") || 1)),
  });
  fail(error);
  revalidatePath(String(formData.get("back") || "/shifts"));
}

/** Rename a shift type or change how many people it takes (also updates the open shifts of that type). */
export async function updateShiftType(formData: FormData) {
  const { supabase } = await lead();
  const id = String(formData.get("id"));
  const name = String(formData.get("name_he") ?? "").trim();
  const slots = Math.max(1, Number(formData.get("slots_per_shift") || 1));
  if (!name) throw new Error("צריך שם למשמרת");
  fail((await supabase.from("shift_roles").update({ name_he: name, slots_per_shift: slots }).eq("id", id)).error);
  fail((await supabase.from("shifts").update({ slots }).eq("shift_role_id", id)).error);
  revalidatePath(String(formData.get("back") || "/shifts"));
}

/** Remove a shift type and every shift opened from it (assignments go with the shifts). */
export async function deleteShiftType(formData: FormData) {
  const { supabase } = await lead();
  const id = String(formData.get("id"));
  fail((await supabase.from("shifts").delete().eq("shift_role_id", id)).error);
  fail((await supabase.from("shift_roles").delete().eq("id", id)).error);
  revalidatePath(String(formData.get("back") || "/shifts"));
}

/**
 * One cell of the board: open this shift type on this day, or close it again.
 * Closing a shift that already has people needs confirm=1 — the screen asks first.
 */
export async function toggleShiftDay(formData: FormData) {
  const { me, supabase } = await lead();
  const roleId = String(formData.get("shift_role_id"));
  const day = String(formData.get("day"));
  const departmentId = String(formData.get("department_id"));
  const { data: existing } = await supabase.from("shifts")
    .select("id, shift_assignments(event_member_id)").eq("event_id", me.eventId).eq("department_id", departmentId)
    .eq("shift_role_id", roleId).eq("day", day).maybeSingle();

  if (existing) {
    const taken = (existing.shift_assignments as unknown[]).length;
    if (taken > 0 && formData.get("confirm") !== "1") throw new Error("יש כבר אנשים במשמרת הזו — אשר את המחיקה");
    fail((await supabase.from("shifts").delete().eq("id", existing.id)).error);
  } else {
    const { data: role } = await supabase.from("shift_roles").select("slots_per_shift").eq("id", roleId).single();
    fail((await supabase.from("shifts").insert({
      event_id: me.eventId, department_id: departmentId, shift_role_id: roleId, day, slots: role?.slots_per_shift ?? 1,
    })).error);
  }
  revalidatePath(String(formData.get("back") || "/shifts"));
}

/** Lead assigns / removes a member on a shift. */
export async function assignShift(formData: FormData) {
  const { supabase } = await lead();
  const shiftId = String(formData.get("shift_id")); const emId = String(formData.get("event_member_id"));
  if (!emId) return;
  if (formData.get("remove") === "1") fail((await supabase.from("shift_assignments").delete().eq("shift_id", shiftId).eq("event_member_id", emId)).error);
  else fail((await supabase.from("shift_assignments").upsert({ shift_id: shiftId, event_member_id: emId })).error);
  revalidatePath(String(formData.get("back") || "/shifts")); revalidatePath("/me");
}

/** Admin: fair-share settings for the event (planning figure only — members do not see a counter). */
export async function setShiftSettings(formData: FormData) {
  const { me, supabase } = await lead();
  if (me.role !== "admin") throw new Error("admin only");
  const { error } = await supabase.from("events").update({
    volunteer_shift_credit: Number(formData.get("volunteer_shift_credit") || 0),
    volunteers_count_in_total: formData.get("volunteers_count_in_total") === "on",
  }).eq("id", me.eventId);
  fail(error);
  revalidatePath("/shifts");
}
